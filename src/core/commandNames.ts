import type { Command } from '../configuration/commands.schema'

export const BUILTIN_COMMAND_NAMES = Object.freeze(['help', 'clear', 'history'] as const)
export type BuiltinCommandName = typeof BUILTIN_COMMAND_NAMES[number]

export function isReservedCommandName(name: string): boolean {
  return BUILTIN_COMMAND_NAMES.some((reserved) => reserved === name)
}

export interface CommandNameConflict {
  value: string
  path: (string | number)[]
  conflictingPath: (string | number)[]
}

// Una sola regla para el registro y la validación cruzada. Las rutas de comandos
// corresponden a commands.json; los nombres internos usan ['builtins', nombre].
export function findCommandNameConflicts(commands: readonly Pick<Command, 'name' | 'aliases'>[]): CommandNameConflict[] {
  const names = new Map<string, (string | number)[]>(
    BUILTIN_COMMAND_NAMES.map((name) => [name, ['builtins', name]]),
  )
  const conflicts: CommandNameConflict[] = []
  commands.forEach((command, index) => {
    const tokens = [
      { value: command.name, path: ['commands', index, 'name'] },
      ...(command.aliases ?? []).map((value, aliasIndex) => ({
        value, path: ['commands', index, 'aliases', aliasIndex],
      })),
    ]
    for (const { value, path } of tokens) {
      const conflictingPath = names.get(value)
      if (conflictingPath) conflicts.push({ value, path, conflictingPath })
      else names.set(value, path)
    }
  })
  return conflicts
}
