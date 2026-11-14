export interface ParsedCommand {
  name: string
  argument?: string
}

export type CommandParseResult =
  | { status: 'valid'; command: ParsedCommand }
  | { status: 'empty' }
  | { status: 'error'; code: 'TOO_MANY_ARGUMENTS' | 'UNSUPPORTED_SYNTAX' }

/** Sintaxis del MVP: comando [argumento]. No interpreta sintaxis de shell. */
export function parseCommand(input: string): CommandParseResult {
  const text = input.trim()
  if (!text) return { status: 'empty' }

  // Rechazar construcciones de shell, sin interpretar ni descomillar tokens.
  // Los saltos internos no pueden usarse para encadenar comandos.
  if (/['"`\\|&;<>\r\n\u2028\u2029]/.test(text)) {
    return { status: 'error', code: 'UNSUPPORTED_SYNTAX' }
  }

  const tokens = text.split(/\s+/)
  if (tokens.some((token) => token.startsWith('-'))) {
    return { status: 'error', code: 'UNSUPPORTED_SYNTAX' }
  }
  if (tokens.length > 2) return { status: 'error', code: 'TOO_MANY_ARGUMENTS' }

  const [name, argument] = tokens as [string, string?]
  return {
    status: 'valid',
    command: argument === undefined ? { name } : { name, argument },
  }
}
