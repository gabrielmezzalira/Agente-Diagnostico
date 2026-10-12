/**
 * Plano B do vínculo (D-02): colar o ID de uma sessão que já existe no Agente. O seletor só mostra
 * este formulário quando a lista de clientes falha ao carregar — nunca com a lista carregada.
 *
 * Valida o formato (UUID, `isValidAgenteSessionId`) ANTES de habilitar o envio: o ID é o destino
 * de tudo o que a reunião transmitir, então texto qualquer não passa (T-08-06). A recusa do
 * servidor aparece depois, no status de envio, sem perder o valor digitado.
 */
import { useState } from 'react';
import { isValidAgenteSessionId } from '@/shared/config/agenteConfig';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';

const FORMAT_ERROR = 'O ID precisa ser um UUID, como aparece no web app do Agente.';
const BUSY_LABEL = { live: 'Vinculando…', ended: 'Enviando…' } as const;

interface ManualSessionIdFormProps {
  mode: 'live' | 'ended';
  busy: boolean;
  onSubmit: (sessionId: string) => void;
}

export function ManualSessionIdForm({ mode, busy, onSubmit }: ManualSessionIdFormProps) {
  const [value, setValue] = useState('');

  const trimmed = value.trim();
  const valid = isValidAgenteSessionId(trimmed);
  const showFormatError = trimmed !== '' && !valid;

  const submit = (): void => {
    if (!valid || busy) return;
    onSubmit(trimmed);
  };

  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <label
        htmlFor="client-picker-manual-id"
        className="text-caption font-semibold uppercase tracking-wide text-muted"
      >
        ID da sessão do Agente
      </label>
      <TextField
        id="client-picker-manual-id"
        value={value}
        disabled={busy}
        aria-busy={busy}
        placeholder="cole aqui o ID (UUID) da sessão ativa"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
      />
      {showFormatError ? (
        <p aria-live="polite" className="text-caption text-muted">
          {FORMAT_ERROR}
        </p>
      ) : null}
      <Button
        variant="primary"
        disabled={!valid || busy}
        onClick={submit}
        className="mt-2"
      >
        {busy ? BUSY_LABEL[mode] : 'Vincular com este ID'}
      </Button>
    </div>
  );
}
