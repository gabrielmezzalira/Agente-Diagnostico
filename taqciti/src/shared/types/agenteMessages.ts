/**
 * Comandos `ui/agente/*` (Fase 8, TAQ-02, D-02/D-03/D-06/D-07): o que a UI pode pedir ao service
 * worker sobre o vínculo reunião → cliente. Ficam num arquivo próprio para `messages.ts` só ganhar o
 * espalhamento dos schemas (um import, uma linha) — a mesma fronteira zod vale para o painel do
 * Meet, a saída larga e a ponte da camada de plataforma.
 *
 * A UI só EMITE comandos; toda a lógica de vínculo e de envio roda no service worker. O resultado
 * de cada comando é tipado (`AgenteCommandResult`): a tela decide a cópia a mostrar pelo `error`.
 */
import { z } from 'zod';

/** Teto de tamanho do id de reunião — o mesmo de `ui/history/*`: nada gigante atravessa a fronteira. */
export const AGENTE_MEETING_ID = z.string().min(1).max(200);

/** UUID do ID manual (plano B, D-02), com a mesma regra de `isValidAgenteSessionId`. */
const SESSION_UUID = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

/** Alvo do vínculo: colar um ID (plano B), escolher um cliente da lista ou criar um cliente só com o nome. */
export const agenteBindTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual'), sessionId: SESSION_UUID }),
  z.object({
    kind: z.literal('client'),
    clientId: z.string().min(1).max(200),
    clientName: z.string().min(1).max(200),
  }),
  z.object({ kind: z.literal('new-client'), name: z.string().trim().min(1).max(120) }),
]);

export type AgenteBindTarget = z.infer<typeof agenteBindTargetSchema>;

/** Comandos que entram em `uiMessageSchema` (espalhados no fim da união). */
export const agenteUiMessageSchemas = [
  z.object({ type: z.literal('ui/agente/clients/list') }),
  z.object({ type: z.literal('ui/agente/meeting/open'), meetingId: AGENTE_MEETING_ID }),
  z.object({ type: z.literal('ui/agente/meeting/defer'), meetingId: AGENTE_MEETING_ID }),
  z.object({
    type: z.literal('ui/agente/meeting/bind'),
    meetingId: AGENTE_MEETING_ID,
    target: agenteBindTargetSchema,
  }),
  /** Descartar (D-11, one-way): só reunião encerrada e não enviada; apaga a cópia local, nada no backend. */
  z.object({ type: z.literal('ui/agente/meeting/discard'), meetingId: AGENTE_MEETING_ID }),
] as const;

export const agenteCommandErrorSchema = z.enum([
  'invalid-state',
  'not-found',
  'unavailable',
  'duplicate',
  'create-client',
  'create-session',
]);

export type AgenteCommandError = z.infer<typeof agenteCommandErrorSchema>;

const clientSummarySchema = z.object({
  id: z.string(),
  client: z.string(),
  name: z.string(),
});

export const agenteCommandResultSchema = z.union([
  z.object({ ok: z.literal(true), clients: z.array(clientSummarySchema).optional() }),
  z.object({ ok: z.literal(false), error: agenteCommandErrorSchema }),
]);

export type AgenteCommandResult = z.infer<typeof agenteCommandResultSchema>;
