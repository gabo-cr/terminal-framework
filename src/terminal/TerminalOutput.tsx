import { MarkdownRenderer } from './MarkdownRenderer'
import type { CommandResult } from '../core/commandResults'

export function TerminalOutput({ result }: { result: CommandResult }) {
  if (result.type === 'clear') return null
  const style = 'whitespace-pre-wrap text-zinc-200 [overflow-wrap:anywhere]'
  switch (result.type) {
    case 'text': return <p className={style}>{result.text}</p>
    case 'markdown': return <MarkdownRenderer markdown={result.markdown} />
    case 'error': return <p role="alert" className="whitespace-pre-wrap text-rose-200 [overflow-wrap:anywhere]">{result.message}</p>
    case 'history': return <ol className={style}>{result.entries.map((entry) => <li key={entry.number}>{entry.number}. {entry.input}</li>)}</ol>
    case 'list': return <div className={style}><p>{result.title}</p><ul>{result.items.map((item) => <li key={item.id}>{item.id} — {item.title}{item.description ? `: ${item.description}` : ''}</li>)}</ul></div>
    case 'help': return (
      <div className={style}>
        <p>{result.title}</p>
        <dl className="mt-2 divide-y divide-white/5">
          {result.commands.map((command) => (
            <div key={command.name} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-x-4 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-x-6">
              <dt className="min-w-0">
                <span className="font-semibold text-[var(--terminal-help)]">{command.name}</span>
                <span className="mt-0.5 block text-xs leading-4 text-zinc-400">
                  {command.usage.map((usage) => <code key={usage} className="block whitespace-pre-wrap font-mono [overflow-wrap:anywhere]">{usage}</code>)}
                </span>
              </dt>
              <dd className="min-w-0">{command.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }
}
