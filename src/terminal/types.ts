import type { CommandResult } from '../core/commandResults'

// La sesión conserva los resultados del motor sin reinterpretarlos.
export interface TerminalEntryData {
  id: string
  command: string
  status: 'pending' | 'success' | 'error'
  results: readonly CommandResult[]
}

export interface TerminalTheme {
  accentColor: string
  terminalBackground: string
}
