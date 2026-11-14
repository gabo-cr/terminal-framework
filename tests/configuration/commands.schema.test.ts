import { describe, expect, it } from 'vitest'
import { commandsSchema, commandSchema } from '../../src/configuration/commands.schema'

const document = { type: 'document', name: 'about', description: 'Sobre mí', content: 'about-me' }
const collection = { type: 'collection', name: 'posts', description: 'Artículos', collection: 'posts' }

describe('commands.json', () => {
  it('acepta un arreglo vacío obligatorio', () => {
    expect(commandsSchema.parse({ version: 1, commands: [] })).toEqual({ version: 1, commands: [] })
  })

  it('acepta ambos tipos, alias y referencias aún no resueltas', () => {
    const input = { version: 1, commands: [document, { ...collection, aliases: ['blog', 'posts-2'] }] }
    expect(commandsSchema.parse(input)).toEqual(input)
  })

  it.each([
    {}, { commands: [] }, { version: 2, commands: [] }, { version: '1', commands: [] },
    { version: 1 }, { version: 1, commands: null }, { version: 1, commands: [], extra: true },
  ])('rechaza el contrato raíz inválido: %j', (input) => {
    expect(commandsSchema.safeParse(input).success).toBe(false)
  })

  it.each([
    { ...document, content: undefined }, { ...collection, collection: undefined },
    { ...document, collection: 'posts' }, { ...collection, content: 'about-me' },
    { ...document, collection: undefined }, { ...collection, content: undefined },
    { ...document, type: 'other' }, { ...document, type: undefined },
    { ...document, name: '' }, { ...document, name: 'About' }, { ...document, name: 'my_cmd' },
    { ...document, name: 'my command' }, { ...document, aliases: ['UPPER'] },
    { ...document, aliases: [''] }, { ...document, aliases: 'about' },
    { ...document, description: '' }, { ...document, description: undefined },
    { ...document, content: 'Bad-ID' }, { ...collection, collection: '' },
    { ...document, extra: true }, { ...collection, extra: true },
  ])('rechaza comandos inválidos o campos del otro tipo: %j', (input) => {
    expect(commandSchema.safeParse(input).success).toBe(false)
  })

  it.each(['help', 'clear', 'history'])('reserva %s tanto en nombres como en alias', (name) => {
    expect(commandSchema.safeParse({ ...document, name }).success).toBe(false)
    expect(commandSchema.safeParse({ ...collection, aliases: [name] }).success).toBe(false)
  })
})
