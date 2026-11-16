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
    case 'help': return <div className={style}><p>{result.title}</p><dl>{result.commands.map((command) => <div key={command.name} className="mt-3"><dt className="font-semibold text-[var(--terminal-help)]">{command.name}</dt><dd>{command.description}<br />{command.usage.join(' | ')}</dd></div>)}</dl></div>
  }
}
