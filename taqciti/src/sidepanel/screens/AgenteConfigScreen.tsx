/**
 * Tela "Agente Diagnóstico": liga/desliga o streaming ao vivo da Taqciti para
 * o backend do Agente Diagnóstico e configura para onde ele vai (D-04/D-08/
 * D-09/D-10). Só composição — toda a lógica de estado mora em
 * `useAgenteConfigForm` (CLAUDE.md, SOLID — Single Responsibility: nada de
 * lógica de negócio aqui dentro).
 *
 * Aberta por `?view=agente` (ver src/sidepanel/route.ts), alcançável a partir
 * da tela inicial — não pelo painel injetado dentro do Meet.
 */
import { AGENTE_BACKEND_URL_DEFAULT, type StreamingReadiness } from '@/shared/config/agenteConfig';
import { useAgenteConfigForm } from '@/shared/hooks/useAgenteConfigForm';
import { AppShell } from '@/shared/ui/AppShell';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { Wordmark } from '@/shared/ui/Wordmark';

const READINESS_LABELS: Record<StreamingReadiness, string> = {
  ready: 'Ligado — a transcrição ao vivo está sendo enviada ao Agente.',
  disabled: 'Desligado — nada é enviado ao Agente.',
  'invalid-url': 'A URL do backend não é válida — nada é enviado.',
  'missing-session': 'Falta o ID da sessão do Agente — nada é enviado.',
  'invalid-session': 'O ID da sessão não parece válido (esperado um UUID) — nada é enviado.',
};

export function AgenteConfigScreen() {
  const {
    config,
    drafts,
    readiness,
    saving,
    justSaved,
    error,
    setField,
    save,
    setStreamingEnabled,
  } = useAgenteConfigForm();

  return (
    <AppShell
      className="animate-fade-in"
      header={
        <header className="glass rounded-b-card px-5 pb-4 pt-6">
          <h1>
            <Wordmark height={26} />
          </h1>
          <h2 className="mt-3 text-title font-semibold text-foreground">Agente Diagnóstico</h2>
          <p className="mt-1.5 max-w-[300px] text-read leading-relaxed text-muted">
            Envie a transcrição ao vivo desta reunião para uma sessão do Agente
          </p>
          <a
            href="?"
            className="mt-3 inline-block text-caption font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Voltar
          </a>
        </header>
      }
    >
      <section className="scroll-region flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
        <label className="flex items-center gap-2.5 text-read text-foreground">
          <input
            type="checkbox"
            checked={config?.streamingEnabled ?? false}
            onChange={(event) => setStreamingEnabled(event.target.checked)}
          />
          Enviar a transcrição ao vivo para o Agente
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="agente-session-id"
            className="text-caption font-semibold uppercase tracking-wide text-muted"
          >
            ID da sessão do Agente
          </label>
          <TextField
            id="agente-session-id"
            value={drafts.agenteSessionId}
            onChange={(event) => setField('agenteSessionId', event.target.value)}
            placeholder="cole aqui o ID (UUID) da sessão ativa"
          />
          <p className="text-caption text-muted">
            Copie o ID da sessão ativa no web app do Agente. O vínculo vale para esta reunião: numa
            reunião nova, salve o ID da nova sessão.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="agente-backend-url"
            className="text-caption font-semibold uppercase tracking-wide text-muted"
          >
            URL do backend do Agente
          </label>
          <TextField
            id="agente-backend-url"
            value={drafts.agenteBackendUrl}
            onChange={(event) => setField('agenteBackendUrl', event.target.value)}
            placeholder={AGENTE_BACKEND_URL_DEFAULT}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="agente-api-key"
            className="text-caption font-semibold uppercase tracking-wide text-muted"
          >
            Chave de autenticação (opcional)
          </label>
          <TextField
            id="agente-api-key"
            type="password"
            autoComplete="off"
            value={drafts.agenteApiKey}
            onChange={(event) => setField('agenteApiKey', event.target.value)}
            placeholder="deixe em branco para não usar"
          />
        </div>

        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={saving || config === null}
        >
          {justSaved ? 'Salvo!' : 'Salvar'}
        </Button>

        <p aria-live="polite" className="text-caption text-muted">
          {readiness ? READINESS_LABELS[readiness] : ''}
        </p>
        {error ? (
          <p aria-live="assertive" className="text-caption text-danger">
            {error}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
