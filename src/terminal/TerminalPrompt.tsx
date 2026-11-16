import { useEffect, useRef } from 'react'

export function TerminalPrompt({ label, value = '', onChange, onSubmit, pending = false, onHistoryPrevious, onHistoryNext }: {
  label: string; value?: string; onChange?: (value: string) => void; onSubmit?: () => void; pending?: boolean
  onHistoryPrevious?: () => void; onHistoryNext?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    input.current?.focus({ preventScroll: true })
  }, [])
  return (
    <div className="text-[var(--terminal-command)] mt-3 flex min-w-0 shrink-0 items-center gap-2 border-t border-white/10 pt-3">
      <span aria-hidden="true" className="select-none">$</span>
      <input
        ref={input} onBlur={() => { queueMicrotask(() => input.current?.focus({ preventScroll: true })) }}
        type="text" name="terminal-command" aria-label={label} value={value} readOnly={!onChange || pending} aria-busy={pending}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (!pending && !event.altKey && !event.ctrlKey && !event.metaKey) {
            const navigate = event.key === 'ArrowUp' ? onHistoryPrevious : event.key === 'ArrowDown' ? onHistoryNext : undefined
            if (navigate) { event.preventDefault(); navigate(); return }
          }
          if (event.key === 'Enter') {
            event.preventDefault()
            if (!event.repeat && !pending) onSubmit?.()
          }
        }}
        autoComplete="off" autoCapitalize="none" spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-1 text-base sm:text-[13px] text-inherit caret-current outline-none"
      />
    </div>
  )
}
