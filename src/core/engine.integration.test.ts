// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bootstrapConfiguration } from '../app/bootstrap'
import type { ContentService } from '../content/ContentService'
import { CommandExecutor } from './CommandExecutor'
import { CommandRegistry } from './CommandRegistry'
import { parseCommand } from './parseCommand'
import type { CommandLocale, CommandResult } from './commandResults'

// Una dependencia React transitiva del motor haría fallar esta suite.
vi.mock('react', () => { throw new Error('El Core no debe cargar React') })
vi.mock('react-dom', () => { throw new Error('El Core no debe cargar React DOM') })
vi.mock('react-dom/client', () => { throw new Error('El Core no debe cargar React DOM') })

const directFetch = vi.fn(() => { throw new Error('HTTP directo no permitido') })
beforeEach(() => { directFetch.mockClear(); vi.stubGlobal('fetch', directFetch) })
afterEach(() => { vi.unstubAllGlobals(); expect(directFetch).not.toHaveBeenCalled() })

async function engine(locale: CommandLocale) {
  const fixtures = {
    site: { version: 1, name: 'Archivo ficticio', description: 'Ejemplo de pruebas', locale },
    commands: { version: 1, commands: [
      { type: 'document', name: 'read', description: 'Lectura ficticia', content: 'intro', aliases: ['open'] },
      { type: 'collection', name: 'notes', description: 'Notas ficticias', collection: 'notes', aliases: ['journal'] },
    ] },
    content: { version: 1, collections: [{ id: 'notes', title: 'Notas', intro: 'intro', documents: ['second', 'first'] }],
      documents: ['intro', 'first', 'second', 'outside'].map((id) => ({
        id, title: `Título ${id}`, path: `documents/${id}.md`, format: 'markdown',
      })) },
  }
  const configurationFetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    const key = new URL(String(url)).pathname.split('/').at(-1)?.replace('.json', '') as keyof typeof fixtures
    return Response.json(fixtures[key])
  })
  const config = await bootstrapConfiguration({ baseUrl: 'https://example.com/fixture/', fetch: configurationFetch })
  expect(configurationFetch).toHaveBeenCalledTimes(3)
  const bodies = new Map(config.content.documents.map(({ id }) => [id, `# ${id}\nTexto ficticio sin traducir.`]))
  const getMarkdown = vi.fn(async (id: string) => {
    const markdown = bodies.get(id)
    if (markdown === undefined) throw new Error('No body')
    return markdown
  })
  const content: ContentService = {
    getDocument: (id) => config.content.documents.find((document) => document.id === id),
    getCollection: (id) => config.content.collections.find((collection) => collection.id === id),
    getMarkdown,
  }
  const registry = new CommandRegistry(config.commands.commands)
  const executor = new CommandExecutor({ registry, content, locale: config.site.locale })
  // La sesión de prueba es dueña del historial, como lo será el consumidor.
  const history: string[] = []
  async function run(input: string) {
    const previous = [...history]
    const result = await executor.execute(input, { history: Object.freeze(previous) })
    expect(previous).toEqual(history)
    if (parseCommand(input).status !== 'empty') history.push(input)
    return result
  }
  return { run, registry, executor, content, config, getMarkdown, history }
}

function resultTypes(results: readonly CommandResult[]): string[] {
  return results.map((result) => {
    switch (result.type) {
      case 'help': return result.type
      case 'history': return result.type
      case 'clear': return result.type
      case 'text': return result.type
      case 'markdown': return result.type
      case 'list': return result.type
      case 'error': return result.type
      default: {
        const exhaustive: never = result
        return exhaustive
      }
    }
  })
}

describe.each(['es', 'en'] as const)('sesión integrada en %s', (locale) => {
  it('conecta parser, alias, documentos, colecciones, ayuda, clear e historial', async () => {
    const session = await engine(locale)
    expect(parseCommand('  open  ')).toEqual({ status: 'valid', command: { name: 'open' } })
    expect(session.registry.find('open')).toBe(session.registry.find('read'))
    expect(await session.run('  open  ')).toEqual([{
      type: 'markdown', documentId: 'intro', title: 'Título intro', markdown: '# intro\nTexto ficticio sin traducir.',
    }])
    const intro = await session.run('journal')
    expect(resultTypes(intro)).toEqual(['markdown', 'text'])
    expect(intro[1]).toEqual({ type: 'text', text: locale === 'es'
      ? 'Ejecuta notes list para ver todos los documentos.' : 'Run notes list to see all documents.' })
    const loads = session.getMarkdown.mock.calls.length
    expect(await session.run('journal list')).toEqual([{ type: 'list', title: 'Notas', items: [
      { id: 'second', title: 'Título second', description: undefined },
      { id: 'first', title: 'Título first', description: undefined },
    ] }])
    expect(session.getMarkdown).toHaveBeenCalledTimes(loads)
    expect(await session.run('journal first')).toMatchObject([{ type: 'markdown', documentId: 'first' }])
    expect(await session.run('notes intro')).toMatchObject([{ type: 'markdown', documentId: 'intro' }])
    const help = await session.run('help')
    expect(help).toMatchObject([{ type: 'help', title: locale === 'es' ? 'Comandos disponibles' : 'Available commands', commands: [
      { name: 'help' }, { name: 'clear' }, { name: 'history' },
      { name: 'read', description: 'Lectura ficticia', usage: ['read'] },
      { name: 'notes', description: 'Notas ficticias', usage: ['notes', 'notes list', locale === 'es' ? 'notes <documento>' : 'notes <document>'] },
    ] }])
    expect(await session.run('help journal')).toMatchObject([{ type: 'help', scope: 'command', commands: [{ name: 'notes' }] }])
    expect(await session.run('clear')).toEqual([{ type: 'clear' }])
    const beforeHistory = [...session.history]
    const history = await session.run('  history  ')
    expect(history).toEqual([{ type: 'history', entries: [...beforeHistory, '  history  '].map((input, index) => ({ number: index + 1, input })) }])
    const repeated = await session.run('history')
    expect(repeated).toMatchObject([{ type: 'history', entries: session.history.map((input, index) => ({ number: index + 1, input })) }])
    expect(await session.run(' \t ')).toEqual([])
    expect(session.history).toHaveLength(beforeHistory.length + 2)
    expect(resultTypes([...help, ...history, { type: 'clear' }])).toEqual(['help', 'history', 'clear'])
  })

  const errors = [
    ['read a b', 'TOO_MANY_ARGUMENTS', 'Solo se permite un argumento.', 'Only one argument is allowed.'],
    ['read --all', 'UNSUPPORTED_SYNTAX', 'La sintaxis admite únicamente comando [argumento].', 'The supported syntax is command [argument].'],
    ['missing', 'COMMAND_NOT_FOUND', 'No existe el comando: missing.', 'Command not found: missing.'],
    ['help missing', 'COMMAND_NOT_FOUND', 'No existe el comando: missing.', 'Command not found: missing.'],
    ['open arg', 'INVALID_ARGUMENTS', 'Este comando no acepta argumentos.', 'This command does not accept arguments.'],
    ['clear arg', 'INVALID_ARGUMENTS', 'Este comando no acepta argumentos.', 'This command does not accept arguments.'],
    ['history arg', 'INVALID_ARGUMENTS', 'Este comando no acepta argumentos.', 'This command does not accept arguments.'],
    ['journal outside', 'DOCUMENT_NOT_IN_COLLECTION', 'El documento no pertenece a esta colección.', 'The document does not belong to this collection.'],
  ]
  it.each(errors)('propaga código y mensaje localizados para %s', async (input, code, es, en) => {
    const session = await engine(locale)
    const result = await session.run(input)
    expect(result).toMatchObject([{ type: 'error', code, message: locale === 'es' ? es : en }])
    expect(resultTypes(result)).toEqual(['error'])
    expect(session.getMarkdown).not.toHaveBeenCalled()
    expect(await session.run('open')).toMatchObject([{ type: 'markdown' }])
  })

  it('gestiona catálogo incompleto y fallos asíncronos sin salida parcial', async () => {
    const session = await engine(locale)
    const cause = new Error('Fallo simulado')
    session.getMarkdown.mockRejectedValueOnce(cause)
    expect(await session.run('journal')).toMatchObject([{ type: 'error', code: 'CONTENT_ERROR', cause,
      message: locale === 'es' ? 'No se pudo cargar el contenido. Inténtalo de nuevo.' : 'Could not load the content. Please try again.' }])
    expect(await session.run('journal')).toHaveLength(2)
    session.config.content.documents = session.config.content.documents.filter(({ id }) => id !== 'first')
    expect(await session.run('journal list')).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_FOUND',
      message: locale === 'es' ? 'No se encontró el documento solicitado.' : 'The requested document was not found.' }])
    session.config.content.collections = []
    expect(await session.run('journal')).toMatchObject([{ type: 'error', code: 'COLLECTION_NOT_FOUND',
      message: locale === 'es' ? 'No se encontró la colección solicitada.' : 'The requested collection was not found.' }])
  })

  it('no mezcla historiales al reutilizar el ejecutor para otra sesión', async () => {
    const session = await engine(locale)
    await session.run('read')
    expect(await session.executor.execute('history', { history: ['clear'] })).toEqual([{ type: 'history', entries: [
      { number: 1, input: 'clear' }, { number: 2, input: 'history' },
    ] }])
    expect(session.history).toEqual(['read'])
  })
})
