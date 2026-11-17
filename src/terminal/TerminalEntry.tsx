import type { CommandLocale } from '../core/commandResults'
import { TerminalOutput } from './TerminalOutput'
import type { TerminalEntryData } from './types'

export function TerminalEntry({ entry, pendingLabel, locale = 'es' }: { entry: TerminalEntryData; pendingLabel: string; locale?: CommandLocale }) {
  return (
    <li data-terminal-entry={entry.id} data-status={entry.status} className="space-y-2 py-3 first:pt-0">
      <p className="text-[var(--terminal-command)] whitespace-pre-wrap [overflow-wrap:anywhere]">
        <span aria-hidden="true" className="mr-3 select-none">$</span>{entry.command}
      </p>
      <div className="space-y-2">
        {entry.status === 'pending' && <p role="status" className="text-zinc-400">{pendingLabel}</p>}
        {entry.results.map((result, index) => <TerminalOutput locale={locale} key={index} result={result} />)}
      </div>
    </li>
  )
}
