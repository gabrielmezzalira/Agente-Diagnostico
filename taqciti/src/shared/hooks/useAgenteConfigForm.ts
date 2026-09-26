/**
 * Estado da tela "Agente Diagnóstico" (D-04/D-08/D-09/D-10): assina a config
 * salva em `agenteConfigStore.ts`, mantém um rascunho por campo que só é
 * sobrescrito por uma entrega da assinatura quando aquele campo NÃO foi
 * editado desde o último salvar — a mesma lição do G-06-1 da Fase 6 (nunca
 * apagar texto que a pessoa está digitando), agora com rascunho + marca de
 * edição em vez de polling. Salvar normaliza via `patchAgenteConfig`; o
 * toggle grava na hora, sem esperar o botão "Salvar".
 */
import { useEffect, useRef, useState } from 'react';
import {
  getStreamingReadiness,
  type AgenteConfig,
  type StreamingReadiness,
} from '@/shared/config/agenteConfig';
import { patchAgenteConfig, subscribeAgenteConfig } from '@/shared/config/agenteConfigStore';

export type AgenteConfigField = 'agenteBackendUrl' | 'agenteSessionId' | 'agenteApiKey';

/** Quanto tempo o botão mostra "Salvo!" antes de voltar a "Salvar". */
const JUST_SAVED_MS = 1_500;

type Drafts = Record<AgenteConfigField, string>;

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
  setField: (field: AgenteConfigField, value: string) => void;
  save: () => Promise<void>;
  setStreamingEnabled: (enabled: boolean) => void;
}

export function useAgenteConfigForm(): UseAgenteConfigForm {
  const [config, setConfig] = useState<AgenteConfig | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(EMPTY_DRAFTS);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

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
        agenteApiKey: editedRef.current.agenteApiKey ? prev.agenteApiKey : next.agenteApiKey,
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

  async function save(): Promise<void> {
    setSaving(true);
    try {
      const next = await patchAgenteConfig({
        agenteBackendUrl: drafts.agenteBackendUrl,
        agenteSessionId: drafts.agenteSessionId,
        agenteApiKey: drafts.agenteApiKey,
      });
      editedRef.current = {
        agenteBackendUrl: false,
        agenteSessionId: false,
        agenteApiKey: false,
      };
      setDrafts({
        agenteBackendUrl: next.agenteBackendUrl,
        agenteSessionId: next.agenteSessionId,
        agenteApiKey: next.agenteApiKey,
      });
      setJustSaved(true);
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), JUST_SAVED_MS);
    } finally {
      setSaving(false);
    }
  }

  function setStreamingEnabled(enabled: boolean): void {
    void patchAgenteConfig({ streamingEnabled: enabled });
  }

  return {
    config,
    drafts,
    readiness: config ? getStreamingReadiness(config) : null,
    saving,
    justSaved,
    setField,
    save,
    setStreamingEnabled,
  };
}
