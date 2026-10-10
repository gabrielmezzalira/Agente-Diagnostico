/**
 * Casos de borda da config do Agente (D-08/D-09/D-10): padrões de build,
 * normalização de URL, invariante "salvo vence / ausente cai no padrão"
 * (assumption-delta do plano), prontidão e forma exata da requisição.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGENTE_BACKEND_URL_DEFAULT,
  DEFAULT_AGENTE_CONFIG,
  buildExtensionChunkRequest,
  getStreamingReadiness,
  isStreamingReady,
  isValidAgenteSessionId,
  normalizeAgenteBackendUrl,
  normalizeAgenteConfig,
  type AgenteConfig,
} from './agenteConfig';

describe('padrões da build (VITE_AGENTE_*)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sem VITE_*, os padrões são streamingEnabled=false, agenteSessionId="" e agenteApiKey=""', async () => {
    const mod = await import('./agenteConfig');
    expect(mod.DEFAULT_AGENTE_CONFIG.streamingEnabled).toBe(false);
    expect(mod.DEFAULT_AGENTE_CONFIG.agenteSessionId).toBe('');
    expect(mod.DEFAULT_AGENTE_CONFIG.agenteApiKey).toBe('');
  });

  it('com VITE_AGENTE_STREAMING_ENABLED=true e VITE_AGENTE_BACKEND_URL configurados, os padrões mudam', async () => {
    vi.stubEnv('VITE_AGENTE_STREAMING_ENABLED', 'true');
    vi.stubEnv('VITE_AGENTE_BACKEND_URL', 'https://agente.exemplo');
    const mod = await import('./agenteConfig');
    expect(mod.AGENTE_STREAMING_ENABLED_DEFAULT).toBe(true);
    expect(mod.AGENTE_BACKEND_URL_DEFAULT).toBe('https://agente.exemplo');
    expect(mod.DEFAULT_AGENTE_CONFIG.streamingEnabled).toBe(true);
    expect(mod.DEFAULT_AGENTE_CONFIG.agenteBackendUrl).toBe('https://agente.exemplo');
  });

  it('WR-03: o padrão da build é normalizado — barra no fim e espaço saem, protocolo faltando entra', async () => {
    vi.stubEnv('VITE_AGENTE_BACKEND_URL', ' https://agente.up.railway.app/ ');
    const mod = await import('./agenteConfig');
    expect(mod.AGENTE_BACKEND_URL_DEFAULT).toBe('https://agente.up.railway.app');
    expect(mod.DEFAULT_AGENTE_CONFIG.agenteBackendUrl).toBe('https://agente.up.railway.app');
    expect(mod.normalizeAgenteConfig({}).agenteBackendUrl).toBe('https://agente.up.railway.app');

    vi.resetModules();
    vi.stubEnv('VITE_AGENTE_BACKEND_URL', 'agente.up.railway.app/');
    const semProtocolo = await import('./agenteConfig');
    expect(semProtocolo.AGENTE_BACKEND_URL_DEFAULT).toBe('https://agente.up.railway.app');
  });

  it('WR-03: sem VITE_AGENTE_BACKEND_URL (ou só espaços), o padrão continua http://localhost:8000', async () => {
    vi.stubEnv('VITE_AGENTE_BACKEND_URL', '   ');
    const mod = await import('./agenteConfig');
    expect(mod.AGENTE_BACKEND_URL_DEFAULT).toBe('http://localhost:8000');
  });
});

describe('normalizeAgenteBackendUrl', () => {
  it('trim + barra final removida + prefixo https:// quando falta protocolo', () => {
    expect(normalizeAgenteBackendUrl(' agente.up.railway.app/ ')).toBe('https://agente.up.railway.app');
  });

  it('mantém o protocolo existente e remove barras finais repetidas', () => {
    expect(normalizeAgenteBackendUrl('http://localhost:8000///')).toBe('http://localhost:8000');
  });

  it('string vazia (ou só espaço) continua vazia — quem chama decide o fallback', () => {
    expect(normalizeAgenteBackendUrl('   ')).toBe('');
  });

  /*
   * WR-06: sem protocolo, o padrão é https:// — MAS para host de loopback
   * (dev local) o prefixo tem que ser http://, senão `localhost:8000` vira
   * `https://localhost:8000`, o envio falha por TLS e a tela mostra "Ligado".
   */
  it('host de loopback sem protocolo recebe prefixo http://, não https://', () => {
    expect(normalizeAgenteBackendUrl('localhost:8000')).toBe('http://localhost:8000');
    expect(normalizeAgenteBackendUrl('127.0.0.1:8000')).toBe('http://127.0.0.1:8000');
  });

  it('host que não é loopback continua recebendo https://, mesmo parecendo local', () => {
    expect(normalizeAgenteBackendUrl('meu-servidor-local:8000')).toBe(
      'https://meu-servidor-local:8000',
    );
  });

  /*
   * IN-03: um esquema explícito que não é http/https não pode ganhar prefixo
   * (`ftp://x` virava `https://ftp://x`) — fica como foi digitado e a
   * validação o recusa.
   */
  it('esquema explícito diferente de http/https não recebe prefixo', () => {
    expect(normalizeAgenteBackendUrl('ftp://x')).toBe('ftp://x');
  });
});

describe('normalizeAgenteConfig — invariante "campo salvo vence / campo ausente cai no padrão"', () => {
  it('campo presente com tipo certo vence o padrão', () => {
    const result = normalizeAgenteConfig({ agenteBackendUrl: 'https://custom.exemplo' });
    expect(result.agenteBackendUrl).toBe('https://custom.exemplo');
  });

  it('campo ausente cai no padrão da build', () => {
    const result = normalizeAgenteConfig({});
    expect(result.agenteBackendUrl).toBe(AGENTE_BACKEND_URL_DEFAULT);
    expect(result.streamingEnabled).toBe(DEFAULT_AGENTE_CONFIG.streamingEnabled);
  });

  it('tipo errado cai no padrão (streamingEnabled string em vez de boolean)', () => {
    const result = normalizeAgenteConfig({ streamingEnabled: 'sim' as unknown as boolean });
    expect(result.streamingEnabled).toBe(DEFAULT_AGENTE_CONFIG.streamingEnabled);
  });

  it('URL em branco cai no padrão da build', () => {
    const result = normalizeAgenteConfig({ agenteBackendUrl: '   ' });
    expect(result.agenteBackendUrl).toBe(AGENTE_BACKEND_URL_DEFAULT);
  });

  it('session_id e chave são normalizados com trim', () => {
    const result = normalizeAgenteConfig({ agenteSessionId: '  abc-123  ', agenteApiKey: '  s3cr3t  ' });
    expect(result.agenteSessionId).toBe('abc-123');
    expect(result.agenteApiKey).toBe('s3cr3t');
  });

  it('raw null ou undefined cai inteiramente no padrão', () => {
    expect(normalizeAgenteConfig(null)).toEqual(DEFAULT_AGENTE_CONFIG);
    expect(normalizeAgenteConfig(undefined)).toEqual(DEFAULT_AGENTE_CONFIG);
  });
});

describe('normalizeAgenteConfig — boundMeetingId (CR-01)', () => {
  it('string salva é mantida; ausente ou de tipo errado vira vazio', () => {
    expect(normalizeAgenteConfig({ boundMeetingId: 'M1' }).boundMeetingId).toBe('M1');
    expect(normalizeAgenteConfig({}).boundMeetingId).toBe('');
    expect(normalizeAgenteConfig({ boundMeetingId: 42 as unknown as string }).boundMeetingId).toBe('');
  });
});

describe('isValidAgenteSessionId', () => {
  it('aceita UUID em maiúsculas ou minúsculas', () => {
    expect(isValidAgenteSessionId('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isValidAgenteSessionId('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
  });

  it('rejeita strings que não são UUID', () => {
    expect(isValidAgenteSessionId('não-é-uuid')).toBe(false);
    expect(isValidAgenteSessionId('')).toBe(false);
  });
});

describe('getStreamingReadiness — ordem de precedência disabled > invalid-url > missing-session > invalid-session > ready', () => {
  const READY: AgenteConfig = {
    agenteBackendUrl: 'https://agente.exemplo',
    streamingEnabled: true,
    agenteSessionId: '11111111-1111-1111-1111-111111111111',
    agenteApiKey: 'chave',
    confirmedMeetingId: '',
    boundMeetingId: '',
  };

  it('disabled quando streamingEnabled=false, mesmo com o resto inválido', () => {
    expect(
      getStreamingReadiness({ ...READY, streamingEnabled: false, agenteBackendUrl: 'não é url' }),
    ).toBe('disabled');
  });

  it('invalid-url quando a URL não é http(s) válida', () => {
    expect(getStreamingReadiness({ ...READY, agenteBackendUrl: 'não é url' })).toBe('invalid-url');
  });

  it('missing-session quando agenteSessionId está vazio', () => {
    expect(getStreamingReadiness({ ...READY, agenteSessionId: '' })).toBe('missing-session');
  });

  it('invalid-session quando agenteSessionId não é UUID', () => {
    expect(getStreamingReadiness({ ...READY, agenteSessionId: 'não-é-uuid' })).toBe('invalid-session');
  });

  it('ready quando tudo é válido', () => {
    expect(getStreamingReadiness(READY)).toBe('ready');
    expect(isStreamingReady(READY)).toBe(true);
  });

  /*
   * WR-06: http: só é aceitável em loopback — em qualquer outro host, a
   * chave x-agente-key e a transcrição trafegariam sem TLS.
   */
  it('invalid-url quando o protocolo é http: e o host não é loopback', () => {
    expect(getStreamingReadiness({ ...READY, agenteBackendUrl: 'http://agente.empresa.com' })).toBe(
      'invalid-url',
    );
  });

  it('ready com http: quando o host é loopback (dev local)', () => {
    expect(getStreamingReadiness({ ...READY, agenteBackendUrl: 'http://localhost:8000' })).toBe(
      'ready',
    );
  });

  /*
   * IN-03: os endereços válidos de hoje continuam válidos (passando pela
   * normalização, como acontece no storage) e os que só "pareciam" URL —
   * com query, fragmento ou esquema estranho — passam a ser recusados.
   */
  const readinessOfTypedUrl = (typed: string) =>
    getStreamingReadiness({ ...READY, agenteBackendUrl: normalizeAgenteBackendUrl(typed) });

  it.each(['localhost:8000', 'https://agente.exemplo', 'https://agente.exemplo/caminho', 'https://agente.exemplo/'])(
    'ready com o endereço válido "%s"',
    (typed) => {
      expect(readinessOfTypedUrl(typed)).toBe('ready');
    },
  );

  it.each([
    'https://x.com/?a=b',
    'https://x.com?a=b',
    'https://x.com/caminho/?a=b',
    'https://x.com/#trecho',
    'https://x.com/?',
    'ftp://x',
    'ws://agente.exemplo',
    'file:///etc/passwd',
  ])('invalid-url com o endereço "%s"', (typed) => {
    expect(readinessOfTypedUrl(typed)).toBe('invalid-url');
  });
});

describe('buildExtensionChunkRequest', () => {
  const config: AgenteConfig = {
    agenteBackendUrl: 'https://agente.exemplo',
    streamingEnabled: true,
    agenteSessionId: '11111111-1111-1111-1111-111111111111',
    agenteApiKey: '',
    confirmedMeetingId: '',
    boundMeetingId: '',
  };

  it('monta URL = base + /webhook/extension, método POST', () => {
    const { url, init } = buildExtensionChunkRequest(config, { text: 'oi', speaker: 'Ana' });
    expect(url).toBe('https://agente.exemplo/webhook/extension');
    expect(init.method).toBe('POST');
  });

  it('headers sem a propriedade x-agente-key quando a chave é vazia', () => {
    const { init } = buildExtensionChunkRequest(config, { text: 'oi', speaker: null });
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('x-agente-key');
  });

  it('headers com x-agente-key quando a chave está preenchida', () => {
    const { init } = buildExtensionChunkRequest({ ...config, agenteApiKey: 's3cr3t' }, {
      text: 'oi',
      speaker: null,
    });
    expect(init.headers).toMatchObject({ 'x-agente-key': 's3cr3t' });
  });

  it('corpo com exatamente session_id, text e speaker (speaker null preservado)', () => {
    const { init } = buildExtensionChunkRequest(config, { text: 'oi', speaker: null });
    expect(JSON.parse(init.body as string)).toEqual({
      session_id: config.agenteSessionId,
      text: 'oi',
      speaker: null,
    });
  });
});
