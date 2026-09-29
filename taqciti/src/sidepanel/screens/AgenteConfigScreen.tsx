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
import type { MouseEvent } from 'react';
import { AGENTE_BACKEND_URL_DEFAULT } from '@/shared/config/agenteConfig';
import type { StreamingStatusTone } from '@/shared/config/agenteStatus';
import { useAgenteConfigForm } from '@/shared/hooks/useAgenteConfigForm';
import { useAgenteStreamingStatus } from '@/shared/hooks/useAgenteStreamingStatus';
import { AgenteApiKeyField } from '@/sidepanel/components/AgenteApiKeyField';
import { canGoBackWithinExtension } from '@/sidepanel/backNavigation';
import { AppShell } from '@/shared/ui/AppShell';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { Toggle } from '@/shared/ui/Toggle';
import { Wordmark } from '@/shared/ui/Wordmark';

/** Aviso do status enquanto a config salva ainda não chegou do storage. */
const LOADING_STATUS_TEXT = 'Carregando configuração…';

const TONE_CLASS: Record<StreamingStatusTone, string> = {
  muted: 'text-muted',
  warning: 'text-foreground',
  danger: 'text-danger',
};

/**
 * Volta para a tela de origem (ex.: `?view=history`) quando veio de outra página
 * da extensão; senão deixa o `href="?"` agir (ver `canGoBackWithinExtension`).
 */
function handleBackClick(event: MouseEvent<HTMLAnchorElement>): void {
  if (!canGoBackWithinExtension(document.referrer, window.location.href)) return;
  event.preventDefault();
  window.history.back();
}

export function AgenteConfigScreen() {
  const {
    config,
    drafts,
    readiness,
    saving,
    justSaved,
    error,
    hasApiKey,
    setField,
    save,
    clearApiKey,
    setStreamingEnabled,
  } = useAgenteConfigForm();
  const { view: status, confirmError, confirmNewMeeting } = useAgenteStreamingStatus(readiness);

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
            onClick={handleBackClick}
            className="mt-3 inline-block text-caption font-semibold text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Voltar
          </a>
        </header>
      }
    >
      <section className="scroll-region flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
        <Toggle
          checked={config?.streamingEnabled ?? false}
          onChange={setStreamingEnabled}
          label="Enviar a transcrição ao vivo para o Agente"
        />

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
            disabled={saving}
          />
          <p className="text-caption text-muted">
            Copie o ID da sessão ativa no web app do Agente. Numa reunião nova, salve o ID da nova
            sessão — ou, se for a mesma sessão, confirme quando o aviso aparecer.
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
            disabled={saving}
          />
        </div>

        <AgenteApiKeyField
          value={drafts.agenteApiKey}
          hasApiKey={hasApiKey}
          disabled={saving}
          onChange={(value) => setField('agenteApiKey', value)}
          onRemove={clearApiKey}
        />

        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={saving || config === null}
        >
          {justSaved ? 'Salvo!' : 'Salvar'}
        </Button>

        <p aria-live="polite" className={`text-caption ${TONE_CLASS[status?.tone ?? 'muted']}`}>
          {status?.text ?? (config === null ? LOADING_STATUS_TEXT : '')}
        </p>
        {status?.confirmableMeetingId ? (
          <Button variant="secondary" onClick={confirmNewMeeting}>
            Continuar enviando para esta sessão
          </Button>
        ) : null}
        {confirmError ? (
          <p aria-live="assertive" className="text-caption text-danger">
            {confirmError}
          </p>
        ) : null}
        {error ? (
          <p aria-live="assertive" className="text-caption text-danger">
            {error}
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
