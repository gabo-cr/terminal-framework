import { TerminalEntry } from './TerminalEntry'
import type { TerminalEntryData } from './types'

export function TerminalHistory({ entries, label, pendingLabel }: { entries: readonly TerminalEntryData[]; label: string; pendingLabel: string }) {
  if (entries.length === 0) return null
  return (
    <ol aria-label={label} className="mt-6 divide-y divide-white/15 border-b border-white/15">
      {entries.map((entry) => <TerminalEntry key={entry.id} entry={entry} pendingLabel={pendingLabel} />)}
    </ol>
  )
}
