/**
 * Comandos `ui/agente/*` (plano 08-10, Task 1): validação zod na fronteira e o serviço de associação
 * (listar clientes, abrir o cartão, adiar) com resultado tipado. O vínculo (`bind`) é testado em
 * `agenteBindFlow.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installChromeStorageMock } from '@/test/chromeStorageMock';
import {
  createFakeClientDirectory,
  createFakeSessionGateway,
} from '@/test/fakeClientDirectory';
import {
  unavailableClientDirectory,
  type ClientDirectory,
} from '@/features/agente/clientDirectory';
import { agenteCommandResultSchema } from '@/shared/types/agenteMessages';
import { uiMessageSchema } from '@/shared/types/messages';

const UUID = '22222222-2222-2222-2222-222222222222';

describe('uiMessageSchema — comandos ui/agente/*', () => {
  it('aceita listar clientes, abrir e adiar', () => {
    expect(uiMessageSchema.safeParse({ type: 'ui/agente/clients/list' }).success).toBe(
      true,
    );
    expect(
      uiMessageSchema.safeParse({ type: 'ui/agente/meeting/open', meetingId: 'm1' })
        .success,
    ).toBe(true);
    expect(
      uiMessageSchema.safeParse({ type: 'ui/agente/meeting/defer', meetingId: 'm1' })
        .success,
    ).toBe(true);
  });

  it('recusa meetingId vazio ou com 201 caracteres', () => {
    expect(
      uiMessageSchema.safeParse({ type: 'ui/agente/meeting/open', meetingId: '' })
        .success,
    ).toBe(false);
    expect(
      uiMessageSchema.safeParse({
        type: 'ui/agente/meeting/defer',
        meetingId: 'x'.repeat(201),
      }).success,
    ).toBe(false);
    expect(
      uiMessageSchema.safeParse({
        type: 'ui/agente/meeting/open',
        meetingId: 'x'.repeat(200),
      }).success,
    ).toBe(true);
  });

  it('bind aceita os três alvos e recusa UUID inválido ou nome com 121 caracteres', () => {
    const bind = (target: unknown) =>
      uiMessageSchema.safeParse({
        type: 'ui/agente/meeting/bind',
        meetingId: 'm1',
        target,
      });

    expect(bind({ kind: 'manual', sessionId: UUID }).success).toBe(true);
    expect(bind({ kind: 'client', clientId: 'c1', clientName: 'ACME' }).success).toBe(
      true,
    );
    expect(bind({ kind: 'new-client', name: 'Cliente Novo' }).success).toBe(true);

    expect(bind({ kind: 'manual', sessionId: 'nao-e-uuid' }).success).toBe(false);
    expect(bind({ kind: 'new-client', name: 'n'.repeat(121) }).success).toBe(false);
    expect(bind({ kind: 'new-client', name: '   ' }).success).toBe(false);
    expect(bind({ kind: 'client', clientId: '', clientName: 'ACME' }).success).toBe(
      false,
    );
  });
});

describe('agenteCommandResultSchema', () => {
  it('aceita ok, ok com clientes e erro conhecido; recusa erro fora da lista', () => {
    expect(agenteCommandResultSchema.safeParse({ ok: true }).success).toBe(true);
    expect(
      agenteCommandResultSchema.safeParse({
        ok: true,
        clients: [{ id: 'c1', client: 'ACME', name: 'Projeto' }],
      }).success,
    ).toBe(true);
    expect(
      agenteCommandResultSchema.safeParse({ ok: false, error: 'duplicate' }).success,
    ).toBe(true);
    expect(
      agenteCommandResultSchema.safeParse({ ok: false, error: 'explodiu' }).success,
    ).toBe(false);
  });
});

async function freshService(directory: ClientDirectory = createFakeClientDirectory([])) {
  const mock = installChromeStorageMock({});
  const { createAgenteAssociationService } = await import('./agenteAssociationService');
  const store = await import('@/shared/config/agenteAssociationStore');
  const sessions = createFakeSessionGateway();
  const service = createAgenteAssociationService({ directory, sessions });
  return { mock, service, store };
}

beforeEach(() => {
  vi.resetModules();
});

describe('createAgenteAssociationService', () => {
  it('listClients ordena pelo nome do cliente', async () => {
    const directory = createFakeClientDirectory([
      { id: 'c2', client: 'Zeta', name: 'P2' },
      { id: 'c3', client: 'Ágata', name: 'P3' },
      { id: 'c1', client: 'Beta', name: 'P1' },
    ]);
    const { service } = await freshService(directory);
    const result = await service.listClients();
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.clients?.map((c) => c.client)).toEqual([
      'Ágata',
      'Beta',
      'Zeta',
    ]);
  });

  it('listClients com a origem indisponível responde unavailable', async () => {
    const { service } = await freshService(unavailableClientDirectory);
    expect(await service.listClients()).toEqual({ ok: false, error: 'unavailable' });
  });

  it('open em pending abre o cartão (choosing)', async () => {
    const { service, store } = await freshService();
    await store.applyAssociationEvent('m1', { type: 'created' });
    expect(await service.open('m1')).toEqual({ ok: true });
    expect((await store.getAssociation('m1'))?.state).toBe('choosing');
  });

  it('open em linked responde invalid-state e não muda nada', async () => {
    const { service, store } = await freshService();
    await store.applyAssociationEvent('m1', { type: 'created' });
    await store.applyAssociationEvent('m1', {
      type: 'link-started',
      origin: 'manual-id',
      clientName: 'Sessão 22222222',
      sessionId: UUID,
    });
    await store.applyAssociationEvent('m1', { type: 'link-completed', seedSent: {} });
    expect(await service.open('m1')).toEqual({ ok: false, error: 'invalid-state' });
    expect((await store.getAssociation('m1'))?.state).toBe('linked');
  });

  it('open de reunião sem associação responde not-found', async () => {
    const { service } = await freshService();
    expect(await service.open('nao-existe')).toEqual({ ok: false, error: 'not-found' });
  });

  it('defer em choosing adia (deferred)', async () => {
    const { service, store } = await freshService();
    await store.applyAssociationEvent('m1', { type: 'created' });
    await service.open('m1');
    expect(await service.defer('m1')).toEqual({ ok: true });
    expect((await store.getAssociation('m1'))?.state).toBe('deferred');
  });

  it('defer em pending (cartão nunca aberto) responde invalid-state', async () => {
    const { service, store } = await freshService();
    await store.applyAssociationEvent('m1', { type: 'created' });
    expect(await service.defer('m1')).toEqual({ ok: false, error: 'invalid-state' });
  });
});
