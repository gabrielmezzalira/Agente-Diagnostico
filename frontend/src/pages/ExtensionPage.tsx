import { CheckCircle, Download } from 'lucide-react'
import { EXTENSION_URL } from '../lib/labels'
import AppShell from '../components/layout/AppShell'
import { Card, PageHeader, SectionLabel } from '../components/ui'

const INSTALL_STEPS: React.ReactNode[] = [
  'Baixe o arquivo .zip clicando no botão abaixo.',
  'Extraia a pasta do arquivo baixado.',
  <>No Chrome, acesse <code className="font-mono text-[12.5px] px-1.5 py-0.5 rounded bg-white/[0.06] text-ds-green">chrome://extensions</code> na barra de endereço.</>,
  'Ative o "Modo do desenvolvedor" no canto superior direito.',
  'Clique em "Carregar sem compactação" e selecione a pasta extraída.',
  'O ícone do Agente Diagnóstico aparecerá na barra de extensões.',
]

export default function ExtensionPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Captura"
        title="Extensão Chrome"
        subtitle="Necessária para capturar a transcrição do Google Meet em tempo real."
      />

      <Card className="px-[26px] py-6 flex flex-col gap-6 max-w-[860px]">
        <SectionLabel>Instalação</SectionLabel>
        <ol className="m-0 p-0 list-none flex flex-col gap-4">
          {INSTALL_STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-4">
              <span
                aria-hidden
                className="w-7 h-7 shrink-0 rounded-full bg-ds-green-soft border border-ds-green-line text-ds-green font-mono text-[12px] font-semibold flex items-center justify-center"
              >
                {i + 1}
              </span>
              <span className="text-[14.5px] leading-[1.6] text-ds-text-2 pt-[3px]">{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-4 flex-wrap">
          <a
            href={EXTENSION_URL}
            download
            className="inline-flex items-center justify-center gap-2 h-[38px] px-4 rounded-[10px] text-[13.5px] font-semibold bg-ds-green text-[#04120a] border border-ds-green shadow-[0_0_24px_rgba(62,224,111,0.25)] hover:bg-ds-green-hover transition-colors"
          >
            <Download size={14} aria-hidden /> Baixar extensão v1.0.0
          </a>
          <span className="flex items-center gap-2 text-[13px] text-ds-muted">
            <CheckCircle size={14} aria-hidden className="text-ds-green shrink-0" />
            Depois de instalar, basta abrir o Meet: a extensão começa a capturar sozinha.
          </span>
        </div>
      </Card>
    </AppShell>
  )
}
