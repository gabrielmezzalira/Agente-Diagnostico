/**
 * Plano 08-12, Task 2: portas HTTP da Taqciti (lista/criar cliente e criar sessão) contra as rotas
 * /webhook/extension/*. `fetch` é simulado com `vi.fn`: sem rede.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ClientDirectoryUnavailableError,
  DuplicateClientError,
} from '@/features/agente/clientDirectory';
import {
  AGENTE_CLIENTS_PATH,
  AGENTE_SESSIONS_PATH,
  buildAgenteJsonRequest,
} from '@/shared/config/agenteRoutes';
import { DEFAULT_AGENTE_CONFIG, type AgenteConfig } from '@/shared/config/agenteConfig';
import { createHttpClientDirectory } from './httpClientDirectory';
import { AgenteFinishError } from '@/features/agente/finishPolicy';
import {
  AGENTE_SESSION_NAME_MAX,
  createHttpSessionFinisher,
  createHttpSessionGateway,
} from './httpSessionGateway';

const BACKEND = 'https://agente.exemplo';
const SESSION_UUID = '22222222-2222-4222-8222-222222222222';
const CLIENT_UUID = '33333333-3333-4333-8333-333333333333';

function config(overrides: Partial<AgenteConfig> = {}): AgenteConfig {
  return { ...DEFAULT_AGENTE_CONFIG, agenteBackendUrl: BACKEND, ...overrides };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(cfg: AgenteConfig, response: Response | Error) {
  const fetchMock = vi.fn<typeof fetch>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response.clone()),
  );
  const deps = { loadConfig: () => Promise.resolve(cfg), fetch: fetchMock };
  return { fetchMock, deps };
}

function lastCall(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init: (init ?? {}) as RequestInit };
}

describe('buildAgenteJsonRequest', () => {
  it('monta a URL e manda o header x-agente-key quando há chave', () => {
    const request = buildAgenteJsonRequest(config({ agenteApiKey: 's3cr3t' }), AGENTE_CLIENTS_PATH, {
      method: 'GET',
    });

    expect(request?.url).toBe(`${BACKEND}/webhook/extension/clients`);
    expect((request?.init.headers as Record<string, string>)['x-agente-key']).toBe('s3cr3t');
    expect((request?.init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
  });

  it('sem chave não manda o header', () => {
    const request = buildAgenteJsonRequest(config(), AGENTE_SESSIONS_PATH, {
      method: 'POST',
      body: { a: 1 },
    });

    expect(request?.init.headers).not.toHaveProperty('x-agente-key');
    expect(request?.init.body).toBe('{"a":1}');
  });

  it('URL http fora de loopback devolve null (a chave nunca sai em texto puro)', () => {
    const request = buildAgenteJsonRequest(
      config({ agenteBackendUrl: 'http://agente.exemplo', agenteApiKey: 's3cr3t' }),
      AGENTE_CLIENTS_PATH,
      { method: 'GET' },
    );

    expect(request).toBeNull();
  });
});

describe('createHttpClientDirectory.list', () => {
  it('200 com a lista no formato certo vira ClientSummary[]', async () => {
    const body = [{ id: CLIENT_UUID, client: 'Acme', name: 'Pipeline' }];
    const { deps, fetchMock } = setup(config(), jsonResponse(200, body));

    await expect(createHttpClientDirectory(deps).list()).resolves.toEqual(body);

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${BACKEND}/webhook/extension/clients`);
    expect(init.method).toBe('GET');
  });

  it.each([404, 500])('status %i rejeita como indisponível', async (status) => {
    const { deps } = setup(config(), jsonResponse(status, { detail: 'x' }));

    await expect(createHttpClientDirectory(deps).list()).rejects.toBeInstanceOf(
      ClientDirectoryUnavailableError,
    );
  });

  it('erro de rede rejeita como indisponível', async () => {
    const { deps } = setup(config(), new TypeError('Failed to fetch'));

    await expect(createHttpClientDirectory(deps).list()).rejects.toBeInstanceOf(
      ClientDirectoryUnavailableError,
    );
  });

  it.each([
    ['JSON fora do formato', jsonResponse(200, [{ id: 1 }])],
    ['objeto no lugar da lista', jsonResponse(200, { clients: [] })],
    ['HTML no lugar de JSON', new Response('<html></html>', { status: 200 })],
  ])('%s rejeita como indisponível', async (_label, response) => {
    const { deps } = setup(config(), response);

    await expect(createHttpClientDirectory(deps).list()).rejects.toBeInstanceOf(
      ClientDirectoryUnavailableError,
    );
  });

  it('URL inválida rejeita sem chamar fetch', async () => {
    const { deps, fetchMock } = setup(
      config({ agenteBackendUrl: 'http://agente.exemplo' }),
      jsonResponse(200, []),
    );

    await expect(createHttpClientDirectory(deps).list()).rejects.toBeInstanceOf(
      ClientDirectoryUnavailableError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('createHttpClientDirectory.create', () => {
  it('POST com {name}; 201 vira ClientSummary', async () => {
    const created = { id: CLIENT_UUID, client: 'Nova Co', name: 'Nova Co' };
    const { deps, fetchMock } = setup(config(), jsonResponse(201, created));

    await expect(createHttpClientDirectory(deps).create('Nova Co')).resolves.toEqual(created);

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${BACKEND}/webhook/extension/clients`);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"Nova Co"}');
  });

  it('409 vira DuplicateClientError', async () => {
    const { deps } = setup(config(), jsonResponse(409, { detail: 'Client already exists' }));

    await expect(createHttpClientDirectory(deps).create('Nova Co')).rejects.toBeInstanceOf(
      DuplicateClientError,
    );
  });

  it('outro status vira Error comum (não DuplicateClientError)', async () => {
    const { deps } = setup(config(), jsonResponse(422, { detail: 'x' }));

    const error = await createHttpClientDirectory(deps)
      .create('Nova Co')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(DuplicateClientError);
  });

  it('201 fora do formato vira Error', async () => {
    const { deps } = setup(config(), jsonResponse(201, { id: 'não-é-uuid' }));

    await expect(createHttpClientDirectory(deps).create('Nova Co')).rejects.toBeInstanceOf(Error);
  });
});

describe('createHttpSessionGateway.createSession', () => {
  it('POST com project_id e name; 201 devolve { sessionId }', async () => {
    const { deps, fetchMock } = setup(config(), jsonResponse(201, { id: SESSION_UUID }));

    await expect(
      createHttpSessionGateway(deps).createSession('p1', 'Reunião X'),
    ).resolves.toEqual({ sessionId: SESSION_UUID });

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${BACKEND}/webhook/extension/sessions`);
    expect(JSON.parse(String(init.body))).toEqual({ project_id: 'p1', name: 'Reunião X' });
  });

  it('id que não é UUID vira Error', async () => {
    const { deps } = setup(config(), jsonResponse(201, { id: 'abc' }));

    await expect(createHttpSessionGateway(deps).createSession('p1', 'x')).rejects.toBeInstanceOf(
      Error,
    );
  });

  it('status de erro vira Error', async () => {
    const { deps } = setup(config(), jsonResponse(404, { detail: 'Project not found' }));

    await expect(createHttpSessionGateway(deps).createSession('p1', 'x')).rejects.toBeInstanceOf(
      Error,
    );
  });

  it('título de 300 caracteres vai cortado nos primeiros 200', async () => {
    const { deps, fetchMock } = setup(config(), jsonResponse(201, { id: SESSION_UUID }));
    const title = 'a'.repeat(150) + 'b'.repeat(150);

    await createHttpSessionGateway(deps).createSession('p1', title);

    const body = JSON.parse(String(lastCall(fetchMock).init.body)) as { name: string };
    expect(AGENTE_SESSION_NAME_MAX).toBe(200);
    expect(body.name).toBe(title.slice(0, 200));
    expect(body.name).toHaveLength(200);
  });

  it('título só com espaços omite a chave name', async () => {
    const { deps, fetchMock } = setup(config(), jsonResponse(201, { id: SESSION_UUID }));

    await createHttpSessionGateway(deps).createSession('p1', '   ');

    const body = JSON.parse(String(lastCall(fetchMock).init.body)) as Record<string, unknown>;
    expect(body).toEqual({ project_id: 'p1' });
    expect(body).not.toHaveProperty('name');
  });
});

describe('createHttpSessionFinisher.finishSession (B4-b, plano 08-16)', () => {
  const finishedBody = { id: SESSION_UUID, status: 'finished' };

  async function failure(promise: Promise<unknown>): Promise<AgenteFinishError> {
    const error: unknown = await promise.then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AgenteFinishError);
    return error as AgenteFinishError;
  }

  it('POST sem corpo em /sessions/{id}/finish com o header da chave; 200 vira "finished"', async () => {
    const { deps, fetchMock } = setup(config({ agenteApiKey: 'k' }), jsonResponse(200, finishedBody));

    await expect(createHttpSessionFinisher(deps).finishSession(SESSION_UUID)).resolves.toBe('finished');

    const { url, init } = lastCall(fetchMock);
    expect(url).toBe(`${BACKEND}/webhook/extension/sessions/${SESSION_UUID}/finish`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)['x-agente-key']).toBe('k');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([404, 409])('status %i vira "gone" (não há mais o que encerrar)', async (status) => {
    const { deps } = setup(config(), jsonResponse(status, { detail: 'x' }));

    await expect(createHttpSessionFinisher(deps).finishSession(SESSION_UUID)).resolves.toBe('gone');
  });

  it.each([401, 403, 400, 422])('status %i não repete (retryable false)', async (status) => {
    const { deps } = setup(config(), jsonResponse(status, { detail: 'x' }));

    const error = await failure(createHttpSessionFinisher(deps).finishSession(SESSION_UUID));
    expect(error.retryable).toBe(false);
    expect(error.httpStatus).toBe(status);
  });

  it.each([408, 429, 500, 502, 503])('status %i repete (retryable true)', async (status) => {
    const { deps } = setup(config(), jsonResponse(status, { detail: 'x' }));

    const error = await failure(createHttpSessionFinisher(deps).finishSession(SESSION_UUID));
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(status);
  });

  it('fetch que lança (rede ou timeout) repete, sem status HTTP', async () => {
    const { deps } = setup(config(), new TypeError('Failed to fetch'));

    const error = await failure(createHttpSessionFinisher(deps).finishSession(SESSION_UUID));
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBeNull();
  });

  it.each([
    ['HTML de um proxy', new Response('<html></html>', { status: 200 })],
    ['JSON fora do formato', jsonResponse(200, { ok: true })],
    ['status diferente de finished', jsonResponse(200, { id: SESSION_UUID, status: 'active' })],
  ])('200 com corpo inválido (%s) repete', async (_label, response) => {
    const { deps } = setup(config(), response);

    const error = await failure(createHttpSessionFinisher(deps).finishSession(SESSION_UUID));
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(200);
  });

  it('URL do backend inválida: não repete e nenhum fetch acontece', async () => {
    const { deps, fetchMock } = setup(
      config({ agenteBackendUrl: 'http://agente.exemplo', agenteApiKey: 's3cr3t' }),
      jsonResponse(200, finishedBody),
    );

    const error = await failure(createHttpSessionFinisher(deps).finishSession(SESSION_UUID));
    expect(error.retryable).toBe(false);
    expect(error.httpStatus).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['não-é-uuid', '', '../../clients', `${SESSION_UUID}/../x`])(
    'id inválido (%j): não repete e nenhum fetch acontece (T-08-48)',
    async (sessionId) => {
      const { deps, fetchMock } = setup(config(), jsonResponse(200, finishedBody));

      const error = await failure(createHttpSessionFinisher(deps).finishSession(sessionId));
      expect(error.retryable).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('a mensagem do erro nunca carrega a chave nem o corpo da resposta', async () => {
    const { deps } = setup(
      config({ agenteApiKey: 's3cr3t' }),
      jsonResponse(500, { detail: 'segredo-do-corpo' }),
    );

    const error = await failure(createHttpSessionFinisher(deps).finishSession(SESSION_UUID));
    expect(error.message).not.toContain('s3cr3t');
    expect(error.message).not.toContain('segredo-do-corpo');
  });
});

describe('timeout e gate nos fetches', () => {
  it('todo fetch recebe um signal e a chave segue no header', async () => {
    const { deps, fetchMock } = setup(config({ agenteApiKey: 'k' }), jsonResponse(200, []));

    await createHttpClientDirectory(deps).list();

    const { init } = lastCall(fetchMock);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>)['x-agente-key']).toBe('k');
  });
});
