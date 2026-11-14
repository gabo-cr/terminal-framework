import type { Command } from '../configuration/commands.schema'
import { BUILTIN_COMMAND_NAMES, findCommandNameConflicts } from './commandNames'
import type { BuiltinCommandName, CommandNameConflict } from './commandNames'

export type RegisteredCommand =
  | { readonly kind: 'internal'; readonly name: BuiltinCommandName }
  | (Readonly<Command> & { readonly kind: 'custom' })

export class CommandRegistryError extends Error {
  readonly code = 'COMMAND_CONFLICT'
  readonly conflicts: readonly CommandNameConflict[]

  constructor(conflicts: CommandNameConflict[]) {
    super('Hay conflictos entre los nombres o alias de los comandos.')
    this.name = 'CommandRegistryError'
    this.conflicts = conflicts
  }
}

export class CommandRegistry {
  private readonly commands: readonly RegisteredCommand[]
  private readonly byName = new Map<string, RegisteredCommand>()

  constructor(customCommands: readonly Command[] = []) {
    const conflicts = findCommandNameConflicts(customCommands)
    if (conflicts.length) throw new CommandRegistryError(conflicts)

    const internal: RegisteredCommand[] = BUILTIN_COMMAND_NAMES.map((name) =>
      Object.freeze({ kind: 'internal', name }),
    )
    const custom: RegisteredCommand[] = customCommands.map((command) => {
      const aliases = command.aliases?.slice()
      if (aliases) Object.freeze(aliases)
      return Object.freeze({ ...command, kind: 'custom', ...(aliases ? { aliases } : {}) })
    })
    this.commands = Object.freeze([...internal, ...custom])
    for (const command of this.commands) {
      this.byName.set(command.name, command)
      if (command.kind === 'custom') {
        for (const alias of command.aliases ?? []) this.byName.set(alias, command)
      }
    }
  }

  find(name: string): RegisteredCommand | undefined {
    return this.byName.get(name)
  }

  list(): readonly RegisteredCommand[] {
    return this.commands
  }
}
