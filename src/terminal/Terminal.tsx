import { useId } from 'react'
import type { CSSProperties } from 'react'
import { TerminalHistory } from './TerminalHistory'
import { TerminalOutput } from './TerminalOutput'
import { useTerminalScroll } from './useTerminalScroll'
import { TerminalPrompt } from './TerminalPrompt'
import type { TerminalEntryData, TerminalTheme } from './types'

export interface TerminalProps {
  welcome: string
  theme: TerminalTheme
  entries?: readonly TerminalEntryData[]
  promptValue?: string
  onInputChange?: (value: string) => void
  onSubmit?: () => void
  onHistoryPrevious?: () => void
  onHistoryNext?: () => void
  pending?: boolean
  labels: { history: string; input: string; pending?: string }
}

export function Terminal({ welcome, theme, entries = [], promptValue, labels, onInputChange, onSubmit, pending, onHistoryPrevious, onHistoryNext }: TerminalProps) {
  const titleId = useId()
  const scroll = useTerminalScroll(entries, welcome)
  return (
    <section aria-labelledby={titleId} className="mx-auto w-full min-w-0 max-w-3xl overflow-hidden rounded-xl border border-black/10 shadow-lg shadow-black/10" style={{ backgroundColor: theme.terminalBackground, color: theme.accentColor, '--terminal-accent': theme.accentColor } as CSSProperties}>
      <header className="flex items-center gap-4 border-b border-white/10 px-5 py-4 sm:px-7">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-zinc-500" />
          <span className="size-2.5 rounded-full bg-zinc-500" />
          <span className="size-2.5 rounded-full bg-zinc-500" />
        </div>
        <h2 id={titleId} className="font-mono text-xs tracking-wide text-zinc-400">terminal</h2>
      </header>
      <div className="min-h-64 px-5 pb-6 pt-6 font-mono text-sm leading-7 sm:min-h-80 sm:px-7 sm:pb-8 sm:text-base">
        <div ref={scroll.viewport} onScroll={scroll.onScroll} role="region" aria-label={labels.history} tabIndex={0} className="max-h-[min(60vh,36rem)] min-w-0 overflow-y-auto overscroll-contain rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
          <div ref={scroll.content} className="relative">
            <TerminalOutput result={{ type: 'text', text: welcome }} />
            <TerminalHistory entries={entries} label={labels.history} pendingLabel={labels.pending ?? '…'} />
          </div>
        </div>
        <TerminalPrompt onHistoryPrevious={onHistoryPrevious} onHistoryNext={onHistoryNext} label={labels.input} value={promptValue} onChange={onInputChange} onSubmit={onSubmit} pending={pending} />
      </div>
    </section>
  )
}
