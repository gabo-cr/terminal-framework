import type { CommandLocale } from '../core/commandResults'
import { TerminalEntry } from './TerminalEntry'
import type { TerminalEntryData } from './types'

export function TerminalHistory({ entries, label, pendingLabel, locale = 'es' }: { entries: readonly TerminalEntryData[]; label: string; pendingLabel: string; locale?: CommandLocale }) {
  if (entries.length === 0) return null
  return (
    <ol aria-label={label} className="mt-3 divide-y divide-white/15 border-b border-white/15">
      {entries.map((entry) => <TerminalEntry locale={locale} key={entry.id} entry={entry} pendingLabel={pendingLabel} />)}
    </ol>
  )
}
