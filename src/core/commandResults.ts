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

// Resultados actuales para el futuro ejecutor; no contiene lógica de despacho.
export type CommandResult = HelpResult | CommandNotFoundResult | ClearResult | HistoryResult
