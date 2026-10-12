/**
 * Formulário "Criar cliente novo" do seletor (D-08, D-14, UI-SPEC §3): um campo só, o nome. Tipo de
 * projeto, maturidade e contexto a pessoa completa depois no Agente.
 *
 * Apresentacional: não cria nada — avisa `onSubmit(nome)` e quem compõe cuida da rede. O texto
 * digitado vive aqui, em estado local, justamente para sobreviver a uma falha de criação (o `error`
 * muda por cima do formulário sem desmontá-lo). Esc volta à lista e descarta o texto.
 */
import { useState } from 'react';
import { foldText, isDuplicateClientName } from '@/features/agente/clientSearch';
import type { ClientSummary } from '@/features/agente/clientDirectory';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import type { ClientPickerError } from './ClientPicker';
import { containEscape } from './containEscape';

/** Cópia de cada falha (UI-SPEC "Criar cliente" e "Estados da lista"). */
export const CLIENT_ERROR_COPY: Record<ClientPickerError, string> = {
  duplicate: 'Já existe um cliente com esse nome. Selecione-o na lista.',
  'create-client': 'Não foi possível criar o cliente. Confira a conexão e tente de novo.',
  'create-session':
    'Não foi possível criar a sessão no Agente. A reunião continua guardada só aqui. Tente de novo.',
};

const SUBMIT_LABEL = { live: 'Criar e vincular', ended: 'Criar e enviar' } as const;

interface ClientCreateFormProps {
  mode: 'live' | 'ended';
  /** Texto que já vem preenchido (o termo da busca que não achou ninguém). */
  initialName: string;
  /** Clientes existentes, só para recusar nome repetido antes de ir à rede. */
  clients: readonly ClientSummary[];
  busy: boolean;
  error: ClientPickerError | null;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function ClientCreateForm({
  mode,
  initialName,
  clients,
  busy,
  error,
  onSubmit,
  onCancel,
}: ClientCreateFormProps) {
  const [name, setName] = useState(initialName);
  const [submitted, setSubmitted] = useState<string | null>(null);

  const trimmed = name.trim();
  const localDuplicate = isDuplicateClientName(name, clients);
  // O servidor recusou este mesmo nome: segue bloqueado até a pessoa mudar o texto.
  const serverDuplicate =
    error === 'duplicate' && submitted !== null && foldText(name) === foldText(submitted);
  const nameOk = trimmed.length > 0 && !localDuplicate && !serverDuplicate;

  const message =
    localDuplicate || serverDuplicate
      ? CLIENT_ERROR_COPY.duplicate
      : error && CLIENT_ERROR_COPY[error];

  const submit = (): void => {
    if (!nameOk || busy) return;
    setSubmitted(trimmed);
    onSubmit(trimmed);
  };

  return (
    <div
      className="flex flex-col gap-3"
      onKeyDown={(event) => {
        containEscape(event, onCancel);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="client-create-name"
          className="text-caption font-semibold uppercase tracking-wide text-muted"
        >
          Nome do cliente
        </label>
        <TextField
          id="client-create-name"
          autoFocus
          value={name}
          maxLength={
            120
          } /* limite assumido até a decisão B1 (nome de 1 a 120 caracteres) */
          disabled={busy}
          aria-busy={busy}
          placeholder="Ex.: Empresa XYZ"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (containEscape(event, onCancel)) return;
            if (event.key === 'Enter') submit();
          }}
        />
        <p className="text-caption text-muted">
          Só o nome basta. Tipo de projeto, maturidade e contexto você completa depois no
          Agente.
        </p>
        {message ? (
          <p aria-live="assertive" className="text-caption text-danger">
            {message}
          </p>
        ) : null}
      </div>
      <Button variant="primary" disabled={!nameOk || busy} onClick={submit}>
        {busy ? 'Criando…' : SUBMIT_LABEL[mode]}
      </Button>
      <Button variant="ghost" size="compact" onClick={onCancel}>
        Voltar à lista
      </Button>
    </div>
  );
}
