/**
 * Reporter de status do envio ao Agente (Fase 8, plano 08-11, Task 2): `delivery()` só repassa ao
 * sink quando o valor muda (nunca a cada tentativa) e `dropped()` repassa TODA queda. O sink novo é
 * opcional — quem não o passa continua exatamente como na Fase 7.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AgenteDelivery, AgenteDrop } from '@/shared/config/agenteDeliveryStore';
import { createStatusReporter, type AgenteStatusSink } from './agenteStatusReporter';

const OFFLINE: AgenteDelivery = { status: 'offline', queued: 5, overflow: 0, httpStatus: null, recoveredAt: null };
const DROP: AgenteDrop = {
  sessionId: '11111111-1111-1111-1111-111111111111',
  count: 1,
  reason: 'rejected',
  httpStatus: 500,
  at: 1000,
};

function makeSink() {
  return {
    writeSendOutcome: vi.fn(),
    writeWaiting: vi.fn(),
    writeDelivery: vi.fn(),
    recordDropped: vi.fn(),
  } satisfies AgenteStatusSink;
}

describe('delivery()', () => {
  it('o mesmo valor duas vezes grava uma vez; um campo diferente grava de novo', () => {
    const sink = makeSink();
    const reporter = createStatusReporter(sink);
    reporter.delivery(OFFLINE);
    reporter.delivery({ ...OFFLINE });
    expect(sink.writeDelivery).toHaveBeenCalledTimes(1);
    reporter.delivery({ ...OFFLINE, queued: 6 });
    expect(sink.writeDelivery).toHaveBeenCalledTimes(2);
    expect(sink.writeDelivery).toHaveBeenLastCalledWith({ ...OFFLINE, queued: 6 });
  });

  it('voltar a um valor anterior depois de outro também grava (compara com o último repassado)', () => {
    const sink = makeSink();
    const reporter = createStatusReporter(sink);
    reporter.delivery(OFFLINE);
    reporter.delivery({ ...OFFLINE, status: 'ok' });
    reporter.delivery(OFFLINE);
    expect(sink.writeDelivery).toHaveBeenCalledTimes(3);
  });

  it('sem writeDelivery no sink é no-op, e sendOutcome/waitingForMeeting continuam como na Fase 7', () => {
    const sink: AgenteStatusSink = { writeSendOutcome: vi.fn(), writeWaiting: vi.fn() };
    const reporter = createStatusReporter(sink);
    expect(() => reporter.delivery(OFFLINE)).not.toThrow();
    expect(() => reporter.dropped(DROP)).not.toThrow();

    reporter.sendOutcome('sent', 202);
    expect(sink.writeSendOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ lastOutcome: 'sent', lastHttpStatus: 202 }),
    );
    reporter.waitingForMeeting('m1');
    reporter.waitingForMeeting('m1');
    expect(sink.writeWaiting).toHaveBeenCalledTimes(1);
  });

  it('sem sink nenhum nada acontece', () => {
    const reporter = createStatusReporter();
    expect(() => {
      reporter.delivery(OFFLINE);
      reporter.dropped(DROP);
    }).not.toThrow();
  });
});

describe('dropped()', () => {
  it('toda queda é repassada, sem deduplicar', () => {
    const sink = makeSink();
    const reporter = createStatusReporter(sink);
    reporter.dropped(DROP);
    reporter.dropped({ ...DROP });
    expect(sink.recordDropped).toHaveBeenCalledTimes(2);
    expect(sink.recordDropped).toHaveBeenCalledWith(DROP);
  });
});
