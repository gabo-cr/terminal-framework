import { TerminalOutput } from './TerminalOutput'
import type { TerminalEntryData } from './types'

export function TerminalEntry({ entry }: { entry: TerminalEntryData }) {
  return (
    <li className="space-y-3 py-5 first:pt-0">
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        <span aria-hidden="true" className="mr-3 select-none">$</span>{entry.command}
      </p>
      <div className="space-y-2">
        {entry.outputs.map((text, index) => <TerminalOutput key={index} text={text} />)}
      </div>
    </li>
  )
}
