import { TerminalOutput } from './TerminalOutput'
import type { TerminalEntryData } from './types'

export function TerminalEntry({ entry, pendingLabel }: { entry: TerminalEntryData; pendingLabel: string }) {
  return (
    <li data-status={entry.status} className="space-y-3 py-5 first:pt-0">
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        <span aria-hidden="true" className="mr-3 select-none">$</span>{entry.command}
      </p>
      <div className="space-y-2">
        {entry.status === 'pending' && <p role="status" className="text-zinc-400">{pendingLabel}</p>}
        {entry.results.map((result, index) => <TerminalOutput key={index} result={result} />)}
      </div>
    </li>
  )
}
