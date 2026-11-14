import type { SiteConfig } from '../configuration/site.schema'

export type CommandLocale = SiteConfig['locale']

export interface HelpEntry {
  name: string
  kind: 'internal' | 'custom'
  description: string
  aliases: readonly string[]
  usage: readonly string[]
}

export interface HelpResult {
  type: 'help'
  scope: 'all' | 'command'
  title: string
  commands: readonly HelpEntry[]
}

export interface CommandNotFoundResult {
  type: 'error'
  code: 'COMMAND_NOT_FOUND'
  command: string
  message: string
}

export interface ClearResult {
  type: 'clear'
}

export interface HistoryResult {
  type: 'history'
  entries: readonly { number: number; input: string }[]
}

export interface TextResult {
  type: 'text'
  text: string
}

export interface MarkdownResult {
  type: 'markdown'
  documentId: string
  title: string
  markdown: string
}

export interface ListResult {
  type: 'list'
  title: string
  items: readonly { id: string; title: string; description?: string }[]
}

export interface ExecutionErrorResult {
  type: 'error'
  code: 'TOO_MANY_ARGUMENTS' | 'UNSUPPORTED_SYNTAX' | 'INVALID_ARGUMENTS'
    | 'DOCUMENT_NOT_FOUND' | 'COLLECTION_NOT_FOUND' | 'DOCUMENT_NOT_IN_COLLECTION' | 'CONTENT_ERROR'
  message: string
  command?: string
  argument?: string
  cause?: unknown
}

export type CommandResult = HelpResult | CommandNotFoundResult | ClearResult | HistoryResult
  | TextResult | MarkdownResult | ListResult | ExecutionErrorResult
