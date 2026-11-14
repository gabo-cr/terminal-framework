import type { ContentService } from '../content/ContentService'
import type { CommandRegistry } from './CommandRegistry'
import type { CommandLocale, CommandResult, ExecutionErrorResult, MarkdownResult } from './commandResults'
import { clearCommand, helpCommand, historyCommand } from './internalCommands'
import { parseCommand } from './parseCommand'

const messages = {
  es: {
    TOO_MANY_ARGUMENTS: 'Solo se permite un argumento.',
    UNSUPPORTED_SYNTAX: 'La sintaxis admite únicamente comando [argumento].',
    INVALID_ARGUMENTS: 'Este comando no acepta argumentos.',
    DOCUMENT_NOT_FOUND: 'No se encontró el documento solicitado.',
    COLLECTION_NOT_FOUND: 'No se encontró la colección solicitada.',
    DOCUMENT_NOT_IN_COLLECTION: 'El documento no pertenece a esta colección.',
    CONTENT_ERROR: 'No se pudo cargar el contenido. Inténtalo de nuevo.',
    suggestion: (name: string) => `Ejecuta ${name} list para ver todos los documentos.`,
  },
  en: {
    TOO_MANY_ARGUMENTS: 'Only one argument is allowed.',
    UNSUPPORTED_SYNTAX: 'The supported syntax is command [argument].',
    INVALID_ARGUMENTS: 'This command does not accept arguments.',
    DOCUMENT_NOT_FOUND: 'The requested document was not found.',
    COLLECTION_NOT_FOUND: 'The requested collection was not found.',
    DOCUMENT_NOT_IN_COLLECTION: 'The document does not belong to this collection.',
    CONTENT_ERROR: 'Could not load the content. Please try again.',
    suggestion: (name: string) => `Run ${name} list to see all documents.`,
  },
}

export interface ExecutionContext {
  // Solo instrucciones anteriores: la actual se pasa intacta a historyCommand.
  history: readonly string[]
}

export interface CommandExecutorOptions {
  registry: CommandRegistry
  content: ContentService
  locale: CommandLocale
}

export class CommandExecutor {
  private readonly registry: CommandRegistry
  private readonly content: ContentService
  private readonly locale: CommandLocale

  constructor(options: CommandExecutorOptions) {
    this.registry = options.registry
    this.content = options.content
    this.locale = options.locale
  }

  async execute(input: string, context: ExecutionContext): Promise<CommandResult[]> {
    const parsed = parseCommand(input)
    if (parsed.status === 'empty') return []
    if (parsed.status === 'error') return [this.error(parsed.code)]
    const { name, argument } = parsed.command
    const command = this.registry.find(name)
    if (!command) return [helpCommand({ registry: this.registry, locale: this.locale }, name)]

    if (command.kind === 'internal') {
      if (command.name === 'help') return [helpCommand({ registry: this.registry, locale: this.locale }, argument)]
      if (argument !== undefined) return [this.error('INVALID_ARGUMENTS', command.name, argument)]
      return [command.name === 'clear' ? clearCommand() : historyCommand(context.history, input)]
    }
    if (command.type === 'document' && argument !== undefined) {
      return [this.error('INVALID_ARGUMENTS', command.name, argument)]
    }

    try {
      if (command.type === 'document') return [await this.document(command.content, command.name)]
      const collection = this.content.getCollection(command.collection)
      if (!collection) return [this.error('COLLECTION_NOT_FOUND', command.name)]
      if (argument === undefined) {
        const intro = await this.document(collection.intro, command.name)
        if (intro.type === 'error') return [intro]
        return [intro, { type: 'text', text: messages[this.locale].suggestion(command.name) }]
      }
      if (argument === 'list') {
        const items = []
        for (const id of collection.documents) {
          const document = this.content.getDocument(id)
          if (!document) return [this.error('DOCUMENT_NOT_FOUND', command.name, id)]
          items.push({ id: document.id, title: document.title, description: document.description })
        }
        return [{ type: 'list', title: collection.title, items }]
      }
      if (argument !== collection.intro && !collection.documents.includes(argument)) {
        return [this.error('DOCUMENT_NOT_IN_COLLECTION', command.name, argument)]
      }
      return [await this.document(argument, command.name)]
    } catch (cause) {
      return [{ ...this.error('CONTENT_ERROR', command.name, argument), cause }]
    }
  }

  private error(code: ExecutionErrorResult['code'], command?: string, argument?: string): ExecutionErrorResult {
    return { type: 'error', code, message: messages[this.locale][code], command, argument }
  }

  private async document(id: string, command: string): Promise<MarkdownResult | ExecutionErrorResult> {
    const document = this.content.getDocument(id)
    if (!document) return this.error('DOCUMENT_NOT_FOUND', command, id)
    const markdown = await this.content.getMarkdown(id)
    return { type: 'markdown', documentId: document.id, title: document.title, markdown }
  }
}
