import { describe, expect, it } from 'vitest'
import { CommandRegistry } from './CommandRegistry'
import { clearCommand, helpCommand, historyCommand } from './internalCommands'

const registry = new CommandRegistry([
  { type: 'document', name: 'about', description: 'Sobre mí, sin traducción automática.', content: 'intro', aliases: ['bio'] },
  { type: 'collection', name: 'essays', description: 'Ensayos e ideas', collection: 'essays', aliases: ['blog'] },
])

describe.each(['es', 'en'] as const)('comandos internos en %s', (locale) => {
  const context = { registry, locale }

  it('muestra ayuda general ordenada, con descripciones y sin duplicar alias', () => {
    const result = helpCommand(context)
    expect(result.type).toBe('help')
    if (result.type !== 'help') throw new Error('Se esperaba ayuda')
    expect(result.scope).toBe('all')
    expect(result.title).toBe(locale === 'es' ? 'Comandos disponibles' : 'Available commands')
    expect(result.commands.map(({ name }) => name)).toEqual(['help', 'clear', 'history', 'about', 'essays'])
    expect(result.commands.every(({ description }) => description.length > 0)).toBe(true)
    expect(result.commands[3]?.description).toBe('Sobre mí, sin traducción automática.')
    expect(result.commands[4]?.description).toBe('Ensayos e ideas')
  })

  it('limita el uso de document al nombre, incluso al consultar mediante alias', () => {
    const result = helpCommand(context, 'about')
    expect(result).toEqual(helpCommand(context, 'bio'))
    expect(result).toMatchObject({ type: 'help', scope: 'command', commands: [
      { name: 'about', aliases: ['bio'], usage: ['about'], description: 'Sobre mí, sin traducción automática.' },
    ] })
  })

  it('genera las tres formas de uso de collection con el nombre canónico', () => {
    expect(helpCommand(context, 'blog')).toEqual(helpCommand(context, 'essays'))
    expect(helpCommand(context, 'essays')).toMatchObject({ type: 'help', commands: [
      { name: 'essays', usage: ['essays', 'essays list', `essays <${locale === 'es' ? 'documento' : 'document'}>`] },
    ] })
  })

  it.each(['help', 'clear', 'history'])('genera ayuda específica localizada de %s', (name) => {
    const result = helpCommand(context, name)
    expect(result.type).toBe('help')
    if (result.type !== 'help') throw new Error('Se esperaba ayuda')
    expect(result.title).toBe(locale === 'es' ? `Ayuda de ${name}` : `Help for ${name}`)
    expect(result.commands[0]?.usage).toEqual([name === 'help' ? `help [${locale === 'es' ? 'comando' : 'command'}]` : name])
    const descriptions = locale === 'es'
      ? { help: 'Muestra los comandos disponibles o la ayuda de un comando.', clear: 'Limpia la salida visual sin borrar el historial.', history: 'Muestra el historial de comandos de esta sesión.' }
      : { help: 'Shows available commands or help for a command.', clear: 'Clears the visual output without deleting command history.', history: 'Shows command history for this session.' }
    expect(result.commands[0]?.description).toBe(descriptions[name as keyof typeof descriptions])
  })

  it.each(['unknown', 'ABOUT', ''])('devuelve un error estructurado para %j', (argument) => {
    expect(helpCommand(context, argument)).toEqual({
      type: 'error', code: 'COMMAND_NOT_FOUND', command: argument,
      message: locale === 'es' ? `No existe el comando: ${argument}.` : `Command not found: ${argument}.`,
    })
  })
})

describe('clear', () => {
  it('devuelve una instrucción visual y no toca el historial del llamador', () => {
    const history = Object.freeze(['about', 'clear'])
    expect(clearCommand()).toEqual({ type: 'clear' })
    expect(historyCommand(history, 'history').entries.map(({ input }) => input)).toEqual(['about', 'clear', 'history'])
    expect(history).toEqual(['about', 'clear'])
  })
})

describe('history', () => {
  it('incluye la ejecución actual aunque sea la primera instrucción', () => {
    expect(historyCommand([], '  history  ')).toEqual({ type: 'history', entries: [{ number: 1, input: '  history  ' }] })
  })

  it('numera desde uno sin ordenar, deduplicar ni normalizar las instrucciones', () => {
    const history = Object.freeze(['  ABOUT ', 'essays\tIntro', 'history', 'clear'])
    expect(historyCommand(history, 'history')).toEqual({ type: 'history', entries: [
      { number: 1, input: '  ABOUT ' }, { number: 2, input: 'essays\tIntro' },
      { number: 3, input: 'history' }, { number: 4, input: 'clear' }, { number: 5, input: 'history' },
    ] })
    expect(history).toHaveLength(4)
  })

  it('no conserva una copia independiente entre llamadas', () => {
    const first = historyCommand(['about'], 'history')
    first.entries[0]!.input = 'changed'
    expect(historyCommand([], 'history').entries).toEqual([{ number: 1, input: 'history' }])
    expect(historyCommand(['about'], 'history').entries[0]?.input).toBe('about')
  })
})
