/**
 * O dono do WebSocket do painel AGP (Fase 10, TAQ-05). Segue UMA sessão do Agente de cada vez — a da reunião
 * ao vivo com vínculo explícito (`selectTarget`) — e espelha as perguntas dela no storage que a UI assina.
 * Abre quando há alvo, troca quando o alvo muda, fecha quando não há (a call acabou: a mesma janela em que a
 * sessão já gasta IA) e reconecta com espera crescente se a conexão cair. Código 4004 ("sessão não encontrada
 * ou não ativa") para de vez, sem timer: reconectar não resolve e só iria bater no backend à toa (T-08-49);
 * só um alvo novo (ou o boot) volta a tentar.
 *
 * Só portas injetadas (sem `chrome` nem `WebSocket`): a composição de produção mora em
 * `agpQuestionsFeedInstance.ts`. Não manda nada ao backend — só lê.
 */
import { applyAgpMessage, parseAgpMessage, type AgpQuestion } from '@/features/agente/agpQuestions';
import { EMPTY_AGP_FEED, type AgpConnection, type AgpFeed } from '@/shared/config/agpQuestionsStore';

/** Código que o backend usa quando a sessão não existe ou não está ativa (`routers/ws.py`). */
export const AGP_SESSION_NOT_ACTIVE_CODE = 4004;

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/** Espera antes da tentativa `attempt` (0 = a primeira): 1 s, 2 s, 4 s ... com teto de 30 s. */
export function agpReconnectDelayMs(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, attempt), RECONNECT_MAX_MS);
}

/** O mínimo que o feed usa de um WebSocket (o do navegador cabe aqui). */
export interface AgpSocket {
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  close(): void;
}

export interface AgpFeedTarget {
  sessionId: string;
  /** URL do WebSocket já validada (`buildAgpSocketUrl`). */
  url: string;
}

export interface AgpFeedDeps {
  selectTarget: () => Promise<AgpFeedTarget | null>;
  openSocket: (url: string) => AgpSocket;
  write: (feed: AgpFeed) => Promise<void>;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  onError?: (message: string, error: unknown) => void;
}

interface Following {
  target: AgpFeedTarget;
  socket: AgpSocket | null;
  timer: unknown;
  attempt: number;
  questions: readonly AgpQuestion[];
}

export function createAgpQuestionsFeed(deps: AgpFeedDeps) {
  let following: Following | null = null;
  let writes: Promise<void> = Promise.resolve();
  let reconciling: Promise<void> = Promise.resolve();
  /** O primeiro `run` limpa o storage mesmo sem alvo: sobra de um service worker anterior não pode ficar na tela. */
  let needsInitialClear = true;

  /** Escritas em fila: uma gravação velha nunca passa por cima de uma nova. */
  function publish(sessionId: string | null, connection: AgpConnection, questions: readonly AgpQuestion[]): void {
    const feed: AgpFeed = sessionId === null ? EMPTY_AGP_FEED : { sessionId, connection, questions };
    writes = writes
      .then(() => deps.write(feed))
      .catch((error: unknown) => deps.onError?.('gravar as perguntas do AGP falhou', error));
  }

  function detach(current: Following): void {
    if (current.timer !== null) deps.clearTimer(current.timer);
    current.timer = null;
    const socket = current.socket;
    current.socket = null;
    if (socket === null) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    try {
      socket.close();
    } catch (error) {
      deps.onError?.('fechar o WebSocket do AGP falhou', error);
    }
  }

  function scheduleReconnect(current: Following): void {
    const delay = agpReconnectDelayMs(current.attempt);
    current.attempt += 1;
    publish(current.target.sessionId, 'reconnecting', current.questions);
    current.timer = deps.setTimer(() => {
      current.timer = null;
      if (following === current) connect(current);
    }, delay);
  }

  function connect(current: Following): void {
    let socket: AgpSocket;
    try {
      socket = deps.openSocket(current.target.url);
    } catch (error) {
      deps.onError?.('abrir o WebSocket do AGP falhou', error);
      publish(current.target.sessionId, 'idle', []);
      return;
    }
    current.socket = socket;
    const isCurrent = () => following === current && current.socket === socket;
    socket.onopen = () => {
      if (!isCurrent()) return;
      publish(current.target.sessionId, 'live', current.questions);
    };
    socket.onmessage = (event) => {
      if (!isCurrent() || typeof event.data !== 'string') return;
      const message = parseAgpMessage(event.data);
      if (message === null) return;
      const next = applyAgpMessage(current.questions, message);
      // Só o `initial_state` prova que o backend aceitou a sessão (o `ws.py` aceita a conexão ANTES de validar):
      // zerar a espera no `onopen` deixaria uma falha pós-accept reconectar a cada 1 s para sempre (WR-01).
      if (message.kind === 'initial') current.attempt = 0;
      if (next === current.questions && message.kind !== 'initial') return;
      current.questions = next;
      publish(current.target.sessionId, 'live', next);
    };
    socket.onclose = (event) => {
      if (!isCurrent()) return;
      current.socket = null;
      if (event.code === AGP_SESSION_NOT_ACTIVE_CODE) {
        current.questions = [];
        publish(current.target.sessionId, 'idle', []);
        return;
      }
      scheduleReconnect(current);
    };
  }

  async function run(): Promise<void> {
    const target = await deps.selectTarget();
    const sameTarget =
      following !== null && target !== null && following.target.sessionId === target.sessionId && following.target.url === target.url;
    if (sameTarget) return;

    if (following !== null) detach(following);
    const shouldClear = following !== null || needsInitialClear;
    needsInitialClear = false;
    following = null;
    if (target === null) {
      if (shouldClear) publish(null, 'idle', []);
      return;
    }
    const current: Following = { target, socket: null, timer: null, attempt: 0, questions: [] };
    following = current;
    publish(target.sessionId, 'connecting', []);
    connect(current);
  }

  /**
   * Confere o alvo e ajusta a conexão. Chamadas em fila, uma por vez; idempotente (mesmo alvo = nada a fazer).
   * Resolve só depois que as gravações pendentes saíram para o storage.
   */
  function reconcile(): Promise<void> {
    reconciling = reconciling.then(run).catch((error: unknown) => deps.onError?.('reconciliar o AGP falhou', error));
    return reconciling.then(() => writes);
  }

  return { reconcile };
}
