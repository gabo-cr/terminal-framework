// Datos exclusivamente visuales; no dependen de los resultados del Core.
export interface TerminalEntryData {
  id: string
  command: string
  outputs: readonly string[]
}

export interface TerminalTheme {
  accentColor: string
  terminalBackground: string
}
