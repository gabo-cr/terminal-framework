import { useEffect, useRef } from 'react'

export function TerminalPrompt({ label, value = '', onChange, onSubmit, pending = false, onHistoryPrevious, onHistoryNext }: {
  label: string; value?: string; onChange?: (value: string) => void; onSubmit?: () => void; pending?: boolean
  onHistoryPrevious?: () => void; onHistoryNext?: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const wasPending = useRef(pending)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (pending && !wasPending.current) restoreFocus.current = document.activeElement === input.current
    if (!pending && wasPending.current && restoreFocus.current && document.activeElement === input.current) {
      input.current?.focus({ preventScroll: true })
    }
    wasPending.current = pending
  }, [pending])
  return (
    <div className="mt-6 flex min-w-0 items-center gap-3 rounded-sm focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-current">
      <span aria-hidden="true" className="select-none">$</span>
      <input
        ref={input} onBlur={() => { restoreFocus.current = false }}
        type="text" aria-label={label} value={value} readOnly={!onChange || pending} aria-busy={pending}
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
        className="min-w-0 flex-1 bg-transparent py-2 text-base text-inherit caret-current outline-none"
      />
    </div>
  )
}
