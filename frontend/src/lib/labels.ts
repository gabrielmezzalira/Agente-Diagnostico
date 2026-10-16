export const PROJECT_TYPE_LABELS: Record<string, string> = {
  bi: 'BI',
  ml: 'ML',
  data_engineering: 'Eng. de Dados',
  automation: 'Automação',
  integration: 'Integração',
  science: 'Ciência de Dados',
}

export const DMS_LABELS: Record<number, string> = {
  1: 'Inicial',
  2: 'Gerenciado',
  3: 'Definido',
  4: 'Quantificado',
  5: 'Otimizado',
}

export const EXTENSION_URL =
  'https://github.com/gabrielmezzalira/Agente-Diagnostico/releases/download/v1.0.0/agente-diagnostico-extension-v1.0.0.zip'

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function sessionDurationLabel(startedAt: string, finishedAt: string | null): string {
  const end = finishedAt ? new Date(finishedAt) : new Date()
  const mins = Math.floor((end.getTime() - new Date(startedAt).getTime()) / 60000)
  return mins < 1 ? '< 1 min' : `${mins} min`
}
