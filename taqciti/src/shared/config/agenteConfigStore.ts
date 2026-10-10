/**
 * O registro único da integração com o Agente Diagnóstico (D-08): URL do
 * backend, liga/desliga do streaming, session_id e chave — tudo editável em
 * runtime, sem recompilar a extensão. Espelha o mesmo padrão de
 * `prefsStore.ts` (fila de escrita serializada + `chrome.storage.onChanged`,
 * sem polling): nenhuma superfície guarda cópia própria da config, todas
 * leem o que o storage disser e pedem mudanças por patch.
 *
 * A Fase 8 (TAQ-02, detecção automática de sessão) escreve o
 * `agenteSessionId` detectado por cima deste registro via
 * `patchAgenteConfig({ agenteSessionId })` — o campo manual já existe aqui
 * hoje só para preenchimento à mão (D-04/D-05), e continua servindo de
 * fallback para quando o auto-detect falhar.
 */
import type { Unsubscribe } from '@/shared/types/domain';
import { readLocal, writeLocal } from '@/shared/services/storage';
import { STORAGE_KEYS } from './constants';
import { DEFAULT_AGENTE_CONFIG, normalizeAgenteConfig, type AgenteConfig } from './agenteConfig';

/**
 * Fila de escrita — mesmo motivo de `prefsStore.ts`: sem serializar, dois
 * patches concorrentes fariam read-modify-write sobre a mesma leitura, e o
 * segundo `set` apagaria o campo que o primeiro tinha acabado de gravar.
 */
let queue: Promise<AgenteConfig> = Promise.resolve({ ...DEFAULT_AGENTE_CONFIG });

/** Lê e normaliza. Ausente cai no padrão da build — nunca `undefined`. */
export async function loadAgenteConfig(): Promise<AgenteConfig> {
  return normalizeAgenteConfig(await readLocal<Partial<AgenteConfig>>(STORAGE_KEYS.agenteConfig));
}

/**
 * Aplica um patch e devolve o resultado. É o ÚNICO caminho de escrita: quem
 * chama manda só o campo que está mudando, nunca o objeto inteiro — mandar
 * o objeto inteiro é como uma cópia velha (de outra tela) apagaria o
 * trabalho de outra superfície.
 */
export function patchAgenteConfig(patch: Partial<AgenteConfig>): Promise<AgenteConfig> {
  const run = queue.catch(() => undefined).then(async () => {
    const current = await loadAgenteConfig();
    const next = normalizeAgenteConfig({ ...current, ...patch });
    /*
     * CR-01: o vínculo é "a última reunião desta sessão". Outra sessão = outro
     * vínculo, a menos que o próprio patch já traga o novo.
     */
    if (next.agenteSessionId !== current.agenteSessionId && patch.boundMeetingId === undefined) {
      next.boundMeetingId = '';
    }
    await writeLocal(STORAGE_KEYS.agenteConfig, next);
    return next;
  });
  queue = run;
  return run;
}

/**
 * Assina a config: chama de volta com o valor atual logo de cara e depois a
 * cada mudança, venha ela desta página, de outra aba ou do service worker.
 */
export function subscribeAgenteConfig(onConfig: (config: AgenteConfig) => void): Unsubscribe {
  let live = true;
  /*
   * IN-02: a leitura inicial é assíncrona. Se um `onChanged` chegar antes
   * dela resolver, o valor da leitura já está velho — entregá-lo por cima do
   * novo deixaria a tela com a config antiga. Sem nenhum `onChanged` antes, a
   * leitura inicial é entregue normalmente.
   */
  let gotChange = false;

  void loadAgenteConfig().then((config) => {
    if (live && !gotChange) onConfig(config);
  });

  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (!live || area !== 'local' || !(STORAGE_KEYS.agenteConfig in changes)) return;
    gotChange = true;
    onConfig(
      normalizeAgenteConfig(
        (changes[STORAGE_KEYS.agenteConfig]?.newValue as Partial<AgenteConfig> | undefined) ?? null,
      ),
    );
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    live = false;
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Só as mudanças (sem entrega inicial): o service worker usa para reagir na
 * hora ao toggle (WR-11), sem esperar o próximo flush ou tick.
 */
export function onAgenteConfigChange(onConfig: (config: AgenteConfig) => void): Unsubscribe {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !(STORAGE_KEYS.agenteConfig in changes)) return;
    onConfig(
      normalizeAgenteConfig(
        (changes[STORAGE_KEYS.agenteConfig]?.newValue as Partial<AgenteConfig> | undefined) ?? null,
      ),
    );
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Leitor com cache para o service worker: a primeira chamada lê o storage
 * (uma única vez); as seguintes devolvem a promessa guardada, atualizada só
 * por `onChanged` — nunca relê a cada flush (D-09: custo zero para quem
 * deixa o streaming desligado).
 *
 * O listener é registrado ANTES da leitura inicial para não perder uma
 * mudança que chegue no meio das duas operações assíncronas.
 */
export function createAgenteConfigReader(): () => Promise<AgenteConfig> {
  let cached: Promise<AgenteConfig> | null = null;
  /*
   * WR-08: registrar o listener é separado de ter um `cached` pendente — se
   * a leitura inicial rejeitar, `cached` volta a `null` para a próxima
   * chamada tentar de novo, mas o listener de `onChanged` só pode ser
   * registrado uma vez, senão a segunda tentativa duplicaria o listener.
   */
  let listening = false;

  return function readAgenteConfig(): Promise<AgenteConfig> {
    if (!listening) {
      listening = true;
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !(STORAGE_KEYS.agenteConfig in changes)) return;
        cached = Promise.resolve(
          normalizeAgenteConfig(
            (changes[STORAGE_KEYS.agenteConfig]?.newValue as Partial<AgenteConfig> | undefined) ?? null,
          ),
        );
      });
    }
    if (cached === null) {
      cached = loadAgenteConfig().catch((error: unknown) => {
        cached = null; // próxima chamada tenta de novo
        throw error;
      });
    }
    return cached;
  };
}
