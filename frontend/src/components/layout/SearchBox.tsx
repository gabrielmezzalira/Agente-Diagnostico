import { useEffect, useRef, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'

/** Busca da topbar: Enter leva à lista de projetos filtrada (?q=); ⌘K / Ctrl+K foca o campo. */
export default function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const [params] = useSearchParams()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    const q = inputRef.current?.value.trim() ?? ''
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/')
  }

  return (
    <form onSubmit={submit} role="search" className="flex-1 max-w-[520px]">
      <label className="ds-card !rounded-xl h-[42px] flex items-center gap-2.5 px-4 text-[13.5px] text-ds-muted focus-within:border-ds-green">
        <Search size={14} aria-hidden className="shrink-0" />
        <span className="sr-only">Buscar projetos</span>
        <input
          ref={inputRef}
          key={params.get('q') ?? ''}
          defaultValue={params.get('q') ?? ''}
          type="search"
          placeholder="Buscar projetos"
          className="flex-1 min-w-0 bg-transparent text-ds-text text-[13.5px] outline-none placeholder:text-ds-muted"
        />
        <kbd className="font-mono text-[11px] px-[7px] py-0.5 border border-ds-border-strong rounded-md text-ds-muted">⌘K</kbd>
      </label>
    </form>
  )
}
