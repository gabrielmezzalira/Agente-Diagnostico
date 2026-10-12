/**
 * Estado da tela "Agente Diagnóstico" (D-04/D-08/D-09/D-10): assina a config
 * salva em `agenteConfigStore.ts`, mantém um rascunho por campo que só é
 * sobrescrito por uma entrega da assinatura quando aquele campo NÃO foi
 * editado desde o último salvar — a mesma lição do G-06-1 da Fase 6 (nunca
 * apagar texto que a pessoa está digitando), agora com rascunho + marca de
 * edição em vez de polling. Salvar normaliza via `patchAgenteConfig`; o
 * toggle grava na hora, sem esperar o botão "Salvar".
 *
 * IN-05: a chave salva NUNCA volta para o rascunho (nem para o DOM) — o
 * rascunho dela só guarda o que a pessoa digitou agora. Vazio ao salvar =
 * manter a chave atual; `clearApiKey` é o caminho explícito para apagá-la.
 */
import { useEffect, useRef, useState } from 'react';
import {
  isValidAgenteBackendUrl,
  type AgenteConfig,
  type StreamingReadiness,
} from '@/shared/config/agenteConfig';
import { patchAgenteConfig, subscribeAgenteConfig } from '@/shared/config/agenteConfigStore';
import { resetSendOutcome } from '@/shared/config/agenteStatusStore';
import { logger } from '@/shared/services/log';

/** Mensagem mostrada quando um patch (salvar ou toggle) falha. */
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar a configuração. Tente de novo.';

export type AgenteConfigField = 'agenteBackendUrl' | 'agenteSessionId' | 'agenteApiKey';

/** Quanto tempo o botão mostra "Salvo!" antes de voltar a "Salvar". */
const JUST_SAVED_MS = 1_500;

type Drafts = Record<AgenteConfigField, string>;

/**
 * Prontidão da tela (B5, 08-18): ligado + URL válida. O ID da sessão saiu da conta — o destino vem da
 * associação de cada reunião, não mais da config (por isso `missing-session`/`invalid-session` não existem aqui).
 */
function screenReadiness(config: AgenteConfig): StreamingReadiness {
  if (!config.streamingEnabled) return 'disabled';
  return isValidAgenteBackendUrl(config.agenteBackendUrl) ? 'ready' : 'invalid-url';
}

const EMPTY_DRAFTS: Drafts = {
  agenteBackendUrl: '',
  agenteSessionId: '',
  agenteApiKey: '',
};

interface UseAgenteConfigForm {
  config: AgenteConfig | null;
  drafts: Drafts;
  readiness: StreamingReadiness | null;
  saving: boolean;
  justSaved: boolean;
  error: string | null;
  /** Há uma chave salva (só o fato — o valor nunca sai do store para a tela). */
  hasApiKey: boolean;
  setField: (field: AgenteConfigField, value: string) => void;
  /** Devolve o ID de sessão gravado POR ESTA chamada (`null` = o campo não foi salvo agora, ou falhou). */
  save: () => Promise<string | null>;
  clearApiKey: () => void;
  setStreamingEnabled: (enabled: boolean) => void;
}

export function useAgenteConfigForm(): UseAgenteConfigForm {
  const [config, setConfig] = useState<AgenteConfig | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Ref, não state: marcar "editado" nunca deve, por si só, causar um render —
     quem já causa o render é o próprio setDrafts do setField. */
  const editedRef = useRef<Record<AgenteConfigField, boolean>>({
    agenteBackendUrl: false,
    agenteSessionId: false,
    agenteApiKey: false,
  });
  const justSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeAgenteConfig((next) => {
      setConfig(next);
      setDrafts((prev) => ({
        agenteBackendUrl: editedRef.current.agenteBackendUrl
          ? prev.agenteBackendUrl
          : next.agenteBackendUrl,
        agenteSessionId: editedRef.current.agenteSessionId
          ? prev.agenteSessionId
          : next.agenteSessionId,
        agenteApiKey: prev.agenteApiKey, // IN-05: a chave salva nunca vira rascunho
      }));
    });
  }, []);

  useEffect(
    () => () => {
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
    },
    [],
  );

  function setField(field: AgenteConfigField, value: string): void {
    editedRef.current[field] = true;
    setDrafts((prev) => ({ ...prev, [field]: value }));
  }

  async function save(): Promise<string | null> {
    /*
     * WR-05: manda só os campos marcados como editados (contrato de `patchAgenteConfig`: "só o
     * campo que está mudando"). Mandar os três sobrescrevia valor gravado por outra superfície
     * e gravava o padrão da build sem a pessoa ter mexido nos outros campos.
     * IN-05/IN-03: chave em branco (ou só espaços) = manter a atual, então não entra no patch nem
     * fica "editada" — senão `save()` retornaria em silêncio e a pessoa acharia que trocou a chave.
     */
    const apiKeyIsBlank = editedRef.current.agenteApiKey && drafts.agenteApiKey.trim().length === 0;
    if (apiKeyIsBlank) {
      editedRef.current.agenteApiKey = false;
      setDrafts((prev) => ({ ...prev, agenteApiKey: '' }));
    }
    const editedFields = (Object.keys(editedRef.current) as AgenteConfigField[]).filter(
      (field) => editedRef.current[field],
    );
    if (editedFields.length === 0) return null;

    setSaving(true);
    setError(null);
    try {
      const patch: Partial<AgenteConfig> = {};
      for (const field of editedFields) patch[field] = drafts[field];

      const next = await patchAgenteConfig(patch);

      /*
       * WR-02: URL, sessão ou chave mudaram, então o resultado do último envio
       * era da config anterior. Zerar aqui, do lado de quem grava, não depende
       * de o service worker estar acordado para ouvir o `onChanged` — o status
       * fica em storage.session e sobrevive ao sono dele.
       */
      await resetSendOutcome().catch((err: unknown) => {
        logger.error('zerar o status do Agente falhou', err);
      });

      for (const field of editedFields) editedRef.current[field] = false;
      editedRef.current.agenteApiKey = false;
      setDrafts((prev) => {
        const updated = { ...prev };
        for (const field of editedFields) updated[field] = next[field];
        updated.agenteApiKey = ''; // IN-05: depois de salvar, o campo da chave volta vazio
        return updated;
      });
      setJustSaved(true);
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), JUST_SAVED_MS);
      return editedFields.includes('agenteSessionId') ? next.agenteSessionId : null;
    } catch (err) {
      setError(SAVE_ERROR_MESSAGE);
      logger.error('salvar config do Agente falhou', err);
      return null;
    } finally {
      setSaving(false);
    }
  }

  function clearApiKey(): void {
    setError(null);
    editedRef.current.agenteApiKey = false;
    setDrafts((prev) => ({ ...prev, agenteApiKey: '' }));
    patchAgenteConfig({ agenteApiKey: '' }).catch((err: unknown) => {
      setError(SAVE_ERROR_MESSAGE);
      logger.error('remover chave do Agente falhou', err);
    });
  }

  function setStreamingEnabled(enabled: boolean): void {
    setError(null);
    patchAgenteConfig({ streamingEnabled: enabled }).catch((err: unknown) => {
      setError(SAVE_ERROR_MESSAGE);
      logger.error('alternar streaming do Agente falhou', err);
    });
  }

  return {
    config,
    drafts,
    readiness: config ? screenReadiness(config) : null,
    saving,
    justSaved,
    error,
    hasApiKey: (config?.agenteApiKey.length ?? 0) > 0,
    setField,
    save,
    clearApiKey,
    setStreamingEnabled,
  };
}
