import { suggestCommands } from './suggestCommands'
import type { CommandRegistry, RegisteredCommand } from './CommandRegistry'
import type { ClearResult, CommandLocale, CommandNotFoundResult, HelpEntry, HelpResult, HistoryResult } from './commandResults'

const messages = {
  es: {
    title: 'Comandos disponibles',
    specific: (name: string) => `Ayuda de ${name}`,
    notFound: (name: string) => `No existe el comando: ${name}.`,
    command: 'comando', document: 'documento',
    descriptions: {
      help: 'Muestra los comandos disponibles o la ayuda de un comando.',
      clear: 'Limpia la salida visual sin borrar el historial.',
      history: 'Muestra el historial de comandos de esta sesión.',
    },
  },
  en: {
    title: 'Available commands',
    specific: (name: string) => `Help for ${name}`,
    notFound: (name: string) => `Command not found: ${name}.`,
    command: 'command', document: 'document',
    descriptions: {
      help: 'Shows available commands or help for a command.',
      clear: 'Clears the visual output without deleting command history.',
      history: 'Shows command history for this session.',
    },
  },
}

function helpEntry(command: RegisteredCommand, locale: CommandLocale): HelpEntry {
  const text = messages[locale]
  let usage: string[]
  if (command.kind === 'internal') {
    usage = [command.name === 'help' ? `help [${text.command}]` : command.name]
  } else {
    usage = command.type === 'document' ? [command.name] : [
      command.name, `${command.name} list`, `${command.name} <${text.document}>`,
    ]
  }
  return {
    name: command.name,
    kind: command.kind,
    description: command.kind === 'internal' ? text.descriptions[command.name] : command.description,
    aliases: command.kind === 'custom' ? [...(command.aliases ?? [])] : [],
    usage,
  }
}

export function helpCommand(
  context: { registry: CommandRegistry; locale: CommandLocale },
  argument?: string,
): HelpResult | CommandNotFoundResult {
  const { registry, locale } = context
  const text = messages[locale]
  if (argument === undefined) {
    return { type: 'help', scope: 'all', title: text.title, commands: registry.list().map((command) => helpEntry(command, locale)) }
  }
  const command = registry.find(argument)
  if (!command) {
    return commandNotFoundResult(argument, locale, registry)
  }
  return { type: 'help', scope: 'command', title: text.specific(command.name), commands: [helpEntry(command, locale)] }
}

export function commandNotFoundResult(command: string, locale: CommandLocale, registry?: CommandRegistry): CommandNotFoundResult {
  const suggestions = registry ? suggestCommands(command, registry) : []
  return { type: 'error', code: 'COMMAND_NOT_FOUND', command, message: messages[locale].notFound(command), ...(suggestions.length ? { suggestions } : {}) }
}

export function clearCommand(): ClearResult {
  return { type: 'clear' }
}

// history contiene solo las instrucciones anteriores, en orden cronológico.
// El llamador conserva el historial y registra currentInput una sola vez.
// No se intenta deducir si la instrucción actual ya está incluida.
export function historyCommand(history: readonly string[], currentInput: string): HistoryResult {
  return {
    type: 'history',
    entries: [...history, currentInput].map((input, index) => ({ number: index + 1, input })),
  }
}
