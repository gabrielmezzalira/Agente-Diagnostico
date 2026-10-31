import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAPTURE_STALL_TIMEOUT_MS } from '@/shared/config/constants';
import { GoogleMeetProvider } from './GoogleMeetProvider';

function render(html: string): void {
  document.body.innerHTML = html;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('GoogleMeetProvider — presença confiável e reconciliada', () => {
  it('não promove avatar/falante da legenda a participante', () => {
    render(`
      <div role="region" aria-label="Legendas">
        <div data-participant-id="speaker-only"><span>Ana da legenda</span></div>
      </div>
      <div data-participant-id="self-1">
        <span data-self-name="Bernardo Belfort (Você)">Bernardo Belfort</span>
      </div>
      <div data-participant-id="guest-1">
        <span data-participant-name="Carla Lima">Carla Lima</span>
      </div>
    `);

    const participants = new GoogleMeetProvider().getParticipants();
    expect(participants?.map((entry) => entry.name)).toEqual([
      'Bernardo Belfort',
      'Carla Lima',
    ]);
    expect(participants?.some((entry) => /legenda/i.test(entry.name))).toBe(false);
    expect(participants?.[0]?.isHost).toBe(true);
  });

  it('remove de presentNow quem saiu, preservando firstSeen no retorno', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T10:00:00-03:00'));
    render(`
      <div data-participant-id="self"><span data-self-name="Ana Souza">Ana Souza</span></div>
      <div data-participant-id="guest"><span data-participant-name="Bruno Lima">Bruno Lima</span></div>
    `);
    const provider = new GoogleMeetProvider();
    const first = provider.getParticipants();
    const firstSeen = first?.find((entry) => entry.name === 'Ana Souza')?.firstSeenAt;

    vi.advanceTimersByTime(5_000);
    document.querySelector('[data-participant-id="guest"]')?.remove();
    const current = provider.getParticipants();

    expect(current?.map((entry) => entry.name)).toEqual(['Ana Souza']);
    expect(current?.[0]?.firstSeenAt).toBe(firstSeen);
    expect(current?.[0]?.lastSeenAt).toBe((firstSeen ?? 0) + 5_000);
  });

  it('mantém duas pessoas com o mesmo primeiro nome quando os tiles diferem', () => {
    render(`
      <div data-participant-id="ana-a"><span data-participant-name="Ana Souza">Ana Souza</span></div>
      <div data-participant-id="ana-b"><span data-participant-name="Ana Lima">Ana Lima</span></div>
    `);
    expect(new GoogleMeetProvider().getParticipants()?.map((entry) => entry.name)).toEqual([
      'Ana Souza',
      'Ana Lima',
    ]);
  });

  it('rejeita status/botões e aceita conta pessoal exibida como e-mail', () => {
    render(`
      <div role="listitem" data-user-id="status"><span data-participant-name="Microfone desativado">Microfone desativado</span></div>
      <div role="listitem" data-user-id="personal"><span data-participant-name="conta.pessoal@gmail.com">conta.pessoal@gmail.com</span></div>
    `);
    const participants = new GoogleMeetProvider().getParticipants();
    expect(participants).toHaveLength(1);
    expect(participants?.[0]).toMatchObject({
      providerParticipantId: 'personal',
      source: 'meet_roster',
      confidence: 0.95,
    });
    expect(participants?.[0]?.name.toLowerCase()).toBe('conta.pessoal@gmail.com');
  });
});

describe('GoogleMeetProvider — captura degradada explícita', () => {
  it('preserva a fala com speaker desconhecido e avisa que o parser degradou', () => {
    render(`
      <div role="region" aria-label="Legendas">
        <div>fala preservada sem inventar um participante</div>
      </div>
    `);
    const provider = new GoogleMeetProvider();
    const health: Array<[boolean, string | undefined]> = [];
    const chunks: Array<{ speaker: string | null; text: string }> = [];
    provider.onCaptureHealth((healthy, reason) => health.push([healthy, reason]));
    provider.onCaptionChunk((chunk) => chunks.push(chunk));
    const internals = provider as unknown as {
      captionRegion: Element | null;
      scanCaptions(): void;
    };
    internals.captionRegion = document.querySelector('[role="region"]');
    internals.scanCaptions();

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      speaker: null,
      text: 'fala preservada sem inventar um participante',
    });
    expect(health).toContainEqual([false, 'parser']);
  });
});

describe('GoogleMeetProvider — detecção de reunião pelo endereço', () => {
  const LEAVE_BUTTON = '<button aria-label="Sair da chamada"></button>';

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  function detectAt(pathname: string, html: string = LEAVE_BUTTON) {
    window.history.replaceState({}, '', pathname);
    render(html);
    return new GoogleMeetProvider().detectMeeting();
  }

  it('reconhece o endereço antigo /abc-defg-hij', () => {
    expect(detectAt('/abc-defg-hij')?.meetingCode).toBe('abc-defg-hij');
  });

  it('reconhece o formato novo /meet/abc-defg-hij com o mesmo código', () => {
    expect(detectAt('/meet/abc-defg-hij')?.meetingCode).toBe('abc-defg-hij');
  });

  it.each(['/', '/landing', '/meet', '/meet/', '/meet/abc', '/meet/abc-defg-hij/extra', '/outro/abc-defg-hij'])(
    'não trata %s como reunião',
    (pathname) => {
      expect(detectAt(pathname)).toBeNull();
    },
  );

  it('sem o botão de sair (tela de pré-entrada) não há reunião, mesmo no formato novo', () => {
    expect(detectAt('/meet/abc-defg-hij', '')).toBeNull();
  });
});

describe('GoogleMeetProvider — vigia de captura ciente da pausa', () => {
  const T0 = new Date('2026-10-31T10:00:00-03:00');

  type HealthEvent = [boolean, string | undefined];
  type VigiaInternals = {
    captionsOn: boolean;
    captureExpectedSince: number;
    captureStalled: boolean;
    lastChunkAt: number;
    captionRegion: Element | null;
    checkCaptureHealth(): void;
    scanCaptions(): void;
  };

  function newProvider() {
    const provider = new GoogleMeetProvider();
    const health: HealthEvent[] = [];
    provider.onCaptureHealth((healthy, reason) => health.push([healthy, reason]));
    return { provider, health, internals: provider as unknown as VigiaInternals };
  }

  /** Cenário de travamento: legendas ligadas há 30 s, nada lido, legenda na tela. */
  function armStall(internals: VigiaInternals): void {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    render(`
      <div role="region" aria-label="Legendas"><div>fala na tela</div></div>
    `);
    internals.captionsOn = true;
    internals.captureExpectedSince = Date.now() - 30_000;
    internals.lastChunkAt = 0;
  }

  it('controle: sem pausa, legendas paradas com texto na tela acendem o alarme stall', () => {
    const { health, internals } = newProvider();
    armStall(internals);

    internals.checkCaptureHealth();

    expect(health).toContainEqual([false, 'stall']);
  });

  it('pausado, o mesmo cenário não acende nenhum alarme', () => {
    const { provider, health, internals } = newProvider();
    armStall(internals);

    provider.setCapturePaused(true);
    internals.checkCaptureHealth();

    expect(health.filter(([healthy]) => !healthy)).toEqual([]);
  });

  it('alarme já aceso some quando a pessoa pausa (vigia publica saudável)', () => {
    const { provider, health, internals } = newProvider();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    // DOM com estrutura conhecida (parser saudável) e fala já lida: o reatamento
    // do vigia não emite nada novo, então o alarme stall fica de pé.
    render(`
      <div role="region" aria-label="Legendas">
        <div class="nMcdL"><span class="KcIKyf">Ana Souza</span><div class="bh44bd">fala na tela</div></div>
      </div>
    `);
    internals.captionsOn = true;
    internals.captureExpectedSince = Date.now();
    internals.captionRegion = document.querySelector('[role="region"]');
    internals.scanCaptions();
    vi.advanceTimersByTime(30_000);
    internals.checkCaptureHealth();
    expect(health.at(-1)).toEqual([false, 'stall']);

    provider.setCapturePaused(true);

    expect(health.at(-1)).toEqual([true, undefined]);
  });

  it('aviso do parser degradado também some quando a pessoa pausa', () => {
    const { provider, health, internals } = newProvider();
    render(`
      <div role="region" aria-label="Legendas">
        <div>fala preservada sem inventar um participante</div>
      </div>
    `);
    internals.captionRegion = document.querySelector('[role="region"]');
    internals.scanCaptions();
    expect(health.at(-1)).toEqual([false, 'parser']);

    provider.setCapturePaused(true);

    expect(health.at(-1)).toEqual([true, undefined]);
  });

  describe('retomada', () => {
    const STRUCTURED = `
      <div role="region" aria-label="Legendas">
        <div class="nMcdL"><span class="KcIKyf">Ana Souza</span><div class="bh44bd">fala na tela</div></div>
      </div>
    `;

    /** Legenda lida ANTES da pausa; pausa de 60 s; retoma. */
    function pauseAndResume() {
      const ctx = newProvider();
      const chunks: string[] = [];
      ctx.provider.onCaptionChunk((chunk) => chunks.push(chunk.text));
      vi.useFakeTimers();
      vi.setSystemTime(T0);
      render(STRUCTURED);
      ctx.internals.captionsOn = true;
      ctx.internals.captureExpectedSince = Date.now();
      ctx.internals.captionRegion = document.querySelector('[role="region"]');
      ctx.internals.scanCaptions();
      // Sanidade: 1 fala emitida, parser saudável, nenhum evento de saúde.
      expect(chunks).toHaveLength(1);
      expect(ctx.health).toEqual([]);

      ctx.provider.setCapturePaused(true);
      vi.advanceTimersByTime(60_000);
      ctx.provider.setCapturePaused(false);
      return { ...ctx, chunks };
    }

    it('A: retomar não acusa travamento na hora (a legenda antiga não é fala nova)', () => {
      const { internals, health, chunks } = pauseAndResume();

      internals.checkCaptureHealth();

      expect(internals.captureStalled).toBe(false);
      expect(health).not.toContainEqual([false, 'stall']);
      expect(chunks).toHaveLength(1);
    });

    it('B: os 25 s contam a partir da retomada e o alarme real volta', () => {
      const { internals, health } = pauseAndResume();

      vi.advanceTimersByTime(CAPTURE_STALL_TIMEOUT_MS - 1);
      internals.checkCaptureHealth();
      expect(internals.captureStalled).toBe(false);

      vi.advanceTimersByTime(2);
      internals.checkCaptureHealth();
      expect(internals.captureStalled).toBe(true);
      expect(health.at(-1)).toEqual([false, 'stall']);
    });

    it('C: retomar com as legendas desligadas não passa a esperar captura', () => {
      const { provider, internals } = newProvider();
      internals.captionsOn = false;
      internals.captureExpectedSince = 0;

      provider.setCapturePaused(true);
      provider.setCapturePaused(false);

      expect(internals.captureExpectedSince).toBe(0);
    });

    it('D: parser ainda degradado ao retomar traz o aviso do parser de volta', () => {
      const { provider, health, internals } = newProvider();
      render(`
        <div role="region" aria-label="Legendas">
          <div>fala preservada sem inventar um participante</div>
        </div>
      `);
      internals.captionRegion = document.querySelector('[role="region"]');
      internals.scanCaptions();
      provider.setCapturePaused(true);
      expect(health.at(-1)).toEqual([true, undefined]);

      provider.setCapturePaused(false);

      expect(health.at(-1)).toEqual([false, 'parser']);
    });
  });
});
