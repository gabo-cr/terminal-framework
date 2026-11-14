export function TerminalOutput({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap text-zinc-200 [overflow-wrap:anywhere]">{text}</p>
}
