export function TerminalPrompt({ label, value = '' }: { label: string; value?: string }) {
  return (
    <div className="mt-6 flex min-w-0 items-center gap-3 rounded-sm focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-current">
      <span aria-hidden="true" className="select-none">$</span>
      <input
        type="text" aria-label={label} value={value} readOnly
        autoComplete="off" autoCapitalize="none" spellCheck={false}
        className="min-w-0 flex-1 bg-transparent py-2 text-base text-inherit caret-current outline-none"
      />
    </div>
  )
}
