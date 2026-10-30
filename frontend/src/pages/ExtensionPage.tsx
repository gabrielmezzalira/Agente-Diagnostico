import { AlertTriangle, Download } from 'lucide-react'
import AppShell from '../components/layout/AppShell'
import StepList from '../components/extension/StepList'
import { Card, PageHeader, SectionLabel, buttonClasses } from '../components/ui'
import {
  TAQCITI_AGP_TAB_NOTES,
  TAQCITI_DOWNLOAD_PENDING_NOTICE,
  TAQCITI_INSTALL_STEPS,
  TAQCITI_LINK_STEPS,
  TAQCITI_OLD_EXTENSION_WARNING,
  TAQCITI_RELEASES_URL,
  TAQCITI_SYSTEM_LABELS,
  type TaqcitiInstallSystem,
} from '../lib/taqcitiInstall'

const SYSTEMS: readonly TaqcitiInstallSystem[] = ['windows', 'macos', 'linux']

function AmberNotice({ children }: { children: string }) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-[12px] border border-ds-amber/30 bg-ds-amber/10 px-4 py-3 text-[13.5px] leading-[1.6] text-ds-amber"
    >
      <AlertTriangle size={15} aria-hidden className="shrink-0 mt-[3px]" />
      <span>{children}</span>
    </div>
  )
}

export default function ExtensionPage() {
  return (
    <AppShell>
      <PageHeader
        eyebrow="Captura"
        title="Taqciti"
        subtitle="Extensão do Chrome que captura a transcrição do Google Meet e envia para o Agente Diagnóstico."
      />

      <div className="flex flex-col gap-5 max-w-[860px]">
        <AmberNotice>{TAQCITI_OLD_EXTENSION_WARNING}</AmberNotice>

        <Card className="px-[26px] py-6 flex flex-col gap-6">
          <SectionLabel>Instalação</SectionLabel>
          {TAQCITI_RELEASES_URL === null ? (
            <AmberNotice>{TAQCITI_DOWNLOAD_PENDING_NOTICE}</AmberNotice>
          ) : (
            <div>
              <a
                href={TAQCITI_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses('primary')}
              >
                <Download size={14} aria-hidden /> Baixar a Taqciti
              </a>
            </div>
          )}
          {SYSTEMS.map((system) => (
            <section key={system} className="flex flex-col gap-3">
              <h3 className="m-0 text-[15px] font-semibold text-ds-text">{TAQCITI_SYSTEM_LABELS[system]}</h3>
              <StepList steps={TAQCITI_INSTALL_STEPS[system]} />
            </section>
          ))}
        </Card>

        <Card className="px-[26px] py-6 flex flex-col gap-6">
          <SectionLabel>Vincular a reunião a um cliente</SectionLabel>
          <StepList steps={TAQCITI_LINK_STEPS} />
        </Card>

        <Card className="px-[26px] py-6 flex flex-col gap-6">
          <SectionLabel>Aba AGP (perguntas do Agente na call)</SectionLabel>
          <StepList steps={TAQCITI_AGP_TAB_NOTES} />
        </Card>
      </div>
    </AppShell>
  )
}
