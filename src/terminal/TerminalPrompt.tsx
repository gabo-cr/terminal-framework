export function TerminalPrompt({ label, value = '', onChange, onSubmit, pending = false }: {
  label: string; value?: string; onChange?: (value: string) => void; onSubmit?: () => void; pending?: boolean
}) {
  return (
    <div className="mt-6 flex min-w-0 items-center gap-3 rounded-sm focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-current">
      <span aria-hidden="true" className="select-none">$</span>
      <input
        type="text" aria-label={label} value={value} readOnly={!onChange || pending} aria-busy={pending}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
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
