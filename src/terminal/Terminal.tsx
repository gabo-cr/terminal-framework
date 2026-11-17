import type { CompletionEngine } from '../core/CompletionEngine'
import type { CommandLocale } from '../core/commandResults'
import { useId } from 'react'
import type { CSSProperties } from 'react'
import { TerminalHistory } from './TerminalHistory'
import { TerminalOutput } from './TerminalOutput'
import { useTerminalScroll } from './useTerminalScroll'
import { TerminalPrompt } from './TerminalPrompt'
import type { TerminalEntryData, TerminalTheme } from './types'

export interface TerminalProps {
  completion?: Pick<CompletionEngine, 'complete'>
  locale?: CommandLocale
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

export function Terminal({ welcome, theme, entries = [], promptValue, labels, onInputChange, onSubmit, pending, onHistoryPrevious, onHistoryNext, completion, locale = 'es' }: TerminalProps) {
  const titleId = useId()
  const scroll = useTerminalScroll(entries, welcome)
  return (
    <section aria-labelledby={titleId} className="mx-auto flex min-h-0 w-full min-w-0 max-w-3xl flex-1 flex-col overflow-hidden rounded-xl border border-black/10 shadow-lg shadow-black/10" style={{ backgroundColor: theme.terminalBackground, color: theme.accentColor, '--terminal-accent': theme.accentColor, '--terminal-command': 'color-mix(in srgb, var(--terminal-accent) 78%, white)', '--terminal-help': 'color-mix(in srgb, var(--terminal-accent) 78%, var(--terminal-background))', '--terminal-background': theme.terminalBackground } as CSSProperties}>
      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 px-4 py-3 sm:px-5">
        <div aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-zinc-500" />
          <span className="size-2.5 rounded-full bg-zinc-500" />
          <span className="size-2.5 rounded-full bg-zinc-500" />
        </div>
        <h2 id={titleId} className="font-mono text-xs tracking-wide text-zinc-400">terminal</h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 font-mono text-[13px] leading-5 sm:px-5">
        <div ref={scroll.viewport} onScroll={scroll.onScroll} role="region" aria-label={labels.history} tabIndex={0} className="terminal-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
          <div ref={scroll.content} className="relative">
            <TerminalOutput result={{ type: 'text', text: welcome }} />
            <TerminalHistory locale={locale} entries={entries} label={labels.history} pendingLabel={labels.pending ?? '…'} />
          </div>
        </div>
        <TerminalPrompt completion={completion} locale={locale} onHistoryPrevious={onHistoryPrevious} onHistoryNext={onHistoryNext} label={labels.input} value={promptValue} onChange={onInputChange} onSubmit={onSubmit} pending={pending} />
      </div>
    </section>
  )
}
