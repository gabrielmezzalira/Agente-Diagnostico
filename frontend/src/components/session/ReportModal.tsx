import { useEffect, useRef } from 'react'
import { Copy, FileText, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../ui'

export const MARKDOWN_STYLES = `
  [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3
  [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-2
  [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-4 [&_h3]:mb-1.5
  [&_p]:text-[14px] [&_p]:leading-[1.7] [&_p]:mb-2.5
  [&_ul]:text-[14px] [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:list-disc
  [&_ol]:text-[14px] [&_ol]:pl-5 [&_ol]:space-y-1 [&_ol]:list-decimal
  [&_li]:leading-[1.65]
  [&_strong]:font-semibold [&_strong]:text-white
  [&_a]:text-ds-green [&_a]:underline
  [&_hr]:border-ds-border [&_hr]:my-5
  [&_blockquote]:border-l-2 [&_blockquote]:border-ds-green-line [&_blockquote]:pl-4 [&_blockquote]:text-ds-muted
  [&_table]:w-full [&_table]:text-[13.5px] [&_table]:border-collapse
  [&_th]:text-left [&_th]:font-semibold [&_th]:px-3 [&_th]:py-2 [&_th]:border [&_th]:border-ds-border [&_th]:bg-ds-inner [&_th]:text-white
  [&_td]:px-3 [&_td]:py-2 [&_td]:border [&_td]:border-ds-border [&_td]:align-top [&_td]:leading-snug
  [&_tr:nth-child(even)_td]:bg-white/[0.02]
  [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-white/[0.06] [&_code]:rounded
`

/** Relatório de diagnóstico em Markdown, num diálogo modal. Esc e clique fora fecham. */
export default function ReportModal({ markdown, onClose }: { markdown: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Relatório de Diagnóstico"
        className="ds-card w-full max-w-3xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-ds-border">
          <div className="flex items-center gap-2.5">
            <FileText size={15} aria-hidden className="text-ds-green" />
            <span className="text-[15px] font-semibold text-white">Relatório de Diagnóstico</span>
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md text-ds-muted hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`max-w-none text-ds-text-2 ${MARKDOWN_STYLES}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-ds-border">
          <Button size="sm" onClick={() => navigator.clipboard.writeText(markdown)}>
            <Copy size={12} aria-hidden /> Copiar Markdown
          </Button>
          <Button size="sm" variant="primary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  )
}
