import type { CommandRegistry } from './CommandRegistry'
import type { ContentService } from '../content/ContentService'
import type { CommandLocale } from './commandResults'
import { helpCommand } from './internalCommands'
import { parseCommand } from './parseCommand'
import { registeredCommandTokens } from './suggestCommands'

export interface CompletionSuggestion {
  name: string
  description?: string
  kind: 'command' | 'alias' | 'document' | 'list'
  /** Entrada completa que sustituye al texto consultado; no se ejecuta. */
  insertValue: string
}

export type CompletionResult =
  | { type: 'empty' }
  | { type: 'candidate'; candidate: CompletionSuggestion }
  | { type: 'suggestions'; suggestions: readonly CompletionSuggestion[] }

export interface CompletionEngineOptions {
  registry: CommandRegistry
  catalog: Pick<ContentService, 'getDocument' | 'getCollection'>
  locale?: CommandLocale
}

/** Completa el token al final de la entrada. Solo consulta metadatos en memoria. */
export class CompletionEngine {
  private readonly options: CompletionEngineOptions

  constructor(options: CompletionEngineOptions) {
    this.options = options
  }

  complete(input: string): CompletionResult {
    if (/[\r\n\u2028\u2029]/.test(input)) return { type: 'empty' }
    const parsed = parseCommand(input)
    if (parsed.status !== 'valid') return { type: 'empty' }
    const { registry, catalog, locale = 'es' } = this.options
    const leading = input.match(/^\s*/)?.[0] ?? ''
    const commandToken = parsed.command.name
    const remainder = input.slice(leading.length + commandToken.length)
    const isArgument = remainder.length > 0
    // Tras un argumento y un separador ya no hay un token admitido que completar.
    if (parsed.command.argument !== undefined && /\s$/.test(input)) return { type: 'empty' }
    const prefix = (isArgument ? parsed.command.argument ?? '' : commandToken).toLowerCase()
    const before = isArgument
      ? input.slice(0, input.length - (parsed.command.argument?.length ?? 0)) : leading
    let candidates: CompletionSuggestion[] = []
    const commands = () => {
      const help = helpCommand({ registry, locale })
      const descriptions = help.type === 'help' ? new Map(help.commands.map((entry) => [entry.name, entry.description])) : new Map<string, string>()
      return registeredCommandTokens(registry).filter(({ name }) => !name.startsWith('-')).map(({ name, command }) => ({
        name, description: descriptions.get(command.name),
        kind: name === command.name ? 'command' as const : 'alias' as const,
        insertValue: before + name,
      }))
    }
    if (!isArgument) candidates = commands()
    else {
      const command = registry.find(commandToken.toLowerCase())
      if (command?.kind === 'internal' && command.name === 'help') candidates = commands()
      if (command?.kind === 'custom' && command.type === 'collection') {
        const collection = catalog.getCollection(command.collection)
        if (collection) {
          candidates = [{ name: 'list', kind: 'list', insertValue: before + 'list' }]
          for (const id of [...collection.documents, collection.intro]) {
            const document = catalog.getDocument(id)
            if (document) candidates.push({ name: id, description: document.description, kind: 'document', insertValue: before + id })
          }
        }
      }
    }
    const seen = new Set<string>()
    const matches = candidates.filter(({ name }) => {
      const normalized = name.toLowerCase()
      if (!normalized.startsWith(prefix) || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    if (matches.length === 0) return { type: 'empty' }
    if (matches.length === 1) return { type: 'candidate', candidate: matches[0]! }
    return { type: 'suggestions', suggestions: matches }
  }
}
