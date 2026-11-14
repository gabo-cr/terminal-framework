import { describe, expect, it } from 'vitest'
import type { Command } from '../../src/configuration/commands.schema'
import { commandsSchema } from '../../src/configuration/commands.schema'
import { ConfigurationError } from '../../src/configuration/ConfigurationError'
import { siteSchema } from '../../src/configuration/site.schema'
import { validateConfiguration } from '../../src/configuration/validateConfiguration'
import { CommandRegistry, CommandRegistryError } from '../../src/core/CommandRegistry'

function document(name: string, aliases?: string[]): Command {
  return { type: 'document', name, description: 'Un documento', content: 'intro', aliases }
}

describe('CommandRegistry', () => {
  it('registra automáticamente los internos, sin comandos personalizados', () => {
    const registry = new CommandRegistry()
    expect(registry.list()).toEqual([
      { kind: 'internal', name: 'help' },
      { kind: 'internal', name: 'clear' },
      { kind: 'internal', name: 'history' },
    ])
  })

  it.each(['help', 'clear', 'history'])('resuelve %s consistentemente por nombre y listado', (name) => {
    const registry = new CommandRegistry([document('about')])
    const command = registry.find(name)
    expect(command?.kind).toBe('internal')
    expect(command?.name).toBe(name)
    expect(command).toBe(registry.find(name))
    expect(command).toBe(registry.list().find((entry) => entry.name === name))
  })

  it('reutiliza los comandos validados y conserva ambas variantes y sus referencias', () => {
    const config = commandsSchema.parse({ version: 1, commands: [
      document('about', ['acerca', 'bio']),
      { type: 'collection', name: 'essays', description: 'Ensayos', collection: 'essays', aliases: ['blog'] },
    ] })
    const registry = new CommandRegistry(config.commands)
    expect(registry.find('about')).toEqual({ ...config.commands[0], kind: 'custom' })
    expect(registry.find('essays')).toEqual({ ...config.commands[1], kind: 'custom' })
    expect(registry.find('acerca')).toBe(registry.find('about'))
    expect(registry.find('bio')).toBe(registry.find('about'))
    expect(registry.find('blog')).toBe(registry.find('essays'))
  })

  it('mantiene internos primero y personalizados en orden, sin listar alias por separado', () => {
    const registry = new CommandRegistry([document('zeta', ['last']), document('alpha'), document('middle')])
    expect(registry.list().map(({ name }) => name)).toEqual(['help', 'clear', 'history', 'zeta', 'alpha', 'middle'])
    expect(registry.list()).toBe(registry.list())
  })

  it.each(['missing', '', 'Help', 'ABOUT', ' about ', 'constructor', '__proto__'])('no normaliza ni inventa resultados para %j', (name) => {
    const registry = new CommandRegistry([document('about')])
    expect(registry.find(name)).toBeUndefined()
  })

  const conflicts: [string, Command[]][] = [
    ['nombres repetidos', [document('about'), document('about')]],
    ['nombre contra alias anterior', [document('about', ['bio']), document('bio')]],
    ['alias contra nombre anterior', [document('about'), document('other', ['about'])]],
    ['alias contra alias', [document('about', ['bio']), document('other', ['bio'])]],
    ['alias repetido en el mismo comando', [document('about', ['bio', 'bio'])]],
    ['alias igual al nombre propio', [document('about', ['about'])]],
  ]
  for (const name of ['help', 'clear', 'history']) {
    conflicts.push([`nombre reservado ${name}`, [document(name)]])
    conflicts.push([`alias reservado ${name}`, [document('about', [name])]])
  }

  it.each(conflicts)('rechaza %s con un error tipado y ubicaciones útiles', (_label, commands) => {
    expect(() => new CommandRegistry(commands)).toThrow(CommandRegistryError)
    try {
      new CommandRegistry(commands)
    } catch (error) {
      if (!(error instanceof CommandRegistryError)) throw error
      expect(error.code).toBe('COMMAND_CONFLICT')
      expect(error.conflicts).toHaveLength(1)
      expect(error.conflicts[0]).toMatchObject({
        value: expect.any(String), path: expect.any(Array), conflictingPath: expect.any(Array),
      })
    }
  })

  it('comparte los mismos diagnósticos de conflictos con la validación cruzada', () => {
    const commands = [document('about', ['bio']), document('other', ['bio'])]
    let registryConflicts
    try { new CommandRegistry(commands) } catch (error) {
      if (!(error instanceof CommandRegistryError)) throw error
      registryConflicts = error.conflicts
    }
    expect(registryConflicts).toBeDefined()
    try {
      validateConfiguration({
        site: siteSchema.parse({ version: 1, name: 'Sitio', description: 'Ideas' }),
        commands: { version: 1, commands },
        content: { version: 1, collections: [], documents: [
          { id: 'intro', title: 'Intro', path: 'intro.md', format: 'markdown' },
        ] },
      }, 'https://example.com/')
      throw new Error('Se esperaba conflicto')
    } catch (error) {
      if (!(error instanceof ConfigurationError)) throw error
      expect(error.details.map(({ value, path, conflictingPath }) => ({ value, path, conflictingPath })))
        .toEqual(registryConflicts)
    }
  })

  it('aísla las definiciones de cambios posteriores en la entrada', () => {
    const command = document('about', ['bio'])
    const input = [command]
    const registry = new CommandRegistry(input)
    command.name = 'changed'
    command.aliases?.push('new-alias')
    input.push(document('extra'))
    expect(registry.find('bio')).toBe(registry.find('about'))
    expect(registry.find('about')?.name).toBe('about')
    expect(registry.find('changed')).toBeUndefined()
    expect(registry.find('new-alias')).toBeUndefined()
    expect(registry.find('extra')).toBeUndefined()
    expect(Object.isFrozen(registry.list())).toBe(true)
    expect(Object.isFrozen(registry.find('about'))).toBe(true)
    const registered = registry.find('about')
    if (registered?.kind === 'custom') expect(Object.isFrozen(registered.aliases)).toBe(true)
  })
})
