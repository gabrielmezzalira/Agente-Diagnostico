/**
 * Memória do vínculo CR-01 da Fase 7 — "sessão do Agente → última reunião enviada".
 * Só ids, nunca texto; o service worker é o único escritor da chave em `storage.local`.
 *
 * Extraída de `agenteStreamerInstance.ts` (Fase 8, plano 08-01, commit mecânico) para a instância
 * caber no limite de 300 linhas. O corpo das funções é exatamente o que morava lá.
 */
import { boundMeetingFor, type AgenteBinding } from '@/shared/config/agenteBindingStore';
import { logger } from '@/shared/services/log';
import type { AgenteStreamerDeps } from './agenteStreamerDeps';

export function createBindingRecorder(deps: Pick<AgenteStreamerDeps, 'loadBinding' | 'bindMeeting'>) {
  /** CR-01: última dupla (sessão, reunião) cujo vínculo já foi pedido ao storage — evita regravar a cada flush. */
  let lastBoundKey: string | null = null;
  /** WR-01: cópia em memória do vínculo salvo (`undefined` = ainda não lido neste boot). */
  let storedBinding: AgenteBinding | null | undefined;

  /**
   * WR-01: o vínculo é lido de `storage.local` uma vez e depois vive em memória — o service
   * worker é o único escritor da chave, então a cópia não fica velha. `undefined` = não lido.
   */
  async function currentBinding(): Promise<AgenteBinding | null> {
    if (storedBinding === undefined) storedBinding = (await deps.loadBinding?.()) ?? null;
    return storedBinding;
  }

  /** A reunião vinculada À SESSÃO ATUAL; vazio = nenhuma (inclusive quando o vínculo é de outra sessão). */
  async function boundMeetingForSession(sessionId: string): Promise<string> {
    return boundMeetingFor(await currentBinding(), sessionId);
  }

  /**
   * CR-01: anota em `storage.local` a reunião que o cursor atende. É o que sobra de memória
   * quando o cursor se perde (navegador fechado, extensão atualizada, toggle religado), e é
   * por ele que a reunião do dia seguinte é reconhecida como diferente. Depois do envio, para
   * nunca atrasá-lo; só ids, nunca texto. Com o cursor nulo (inclusive à espera de confirmação)
   * nada é gravado. Falhar só vai para o log e tenta de novo no próximo passo.
   */
  async function record(
    sessionId: string,
    cursorMeetingId: string | null,
    boundMeetingId: string,
  ): Promise<void> {
    if (!deps.bindMeeting || cursorMeetingId === null) return;
    const meetingId = cursorMeetingId;
    const key = `${sessionId}\n${meetingId}`;
    if (meetingId === boundMeetingId || key === lastBoundKey) return;
    lastBoundKey = key;
    try {
      await deps.bindMeeting(sessionId, meetingId);
      storedBinding = { sessionId, meetingId };
    } catch (error) {
      lastBoundKey = null;
      logger.error('gravar a reunião vinculada do Agente falhou', error);
    }
  }

  /** Esquece a última dupla gravada (o streaming parou): a próxima reunião volta a ser anotada. */
  function reset(): void {
    lastBoundKey = null;
  }

  return { boundMeetingFor: boundMeetingForSession, record, reset };
}
