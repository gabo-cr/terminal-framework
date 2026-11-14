import { describe, expect, it, vi } from 'vitest'
import type { ContentService } from '../content/ContentService'
import type { ContentCollection, ContentDocument } from '../configuration/content.schema'
import { bootstrapConfiguration } from '../app/bootstrap'
import { CommandExecutor } from './CommandExecutor'
import { CommandRegistry } from './CommandRegistry'
import type { CommandLocale } from './commandResults'

function setup(locale: CommandLocale = 'es') {
  const documents: ContentDocument[] = ['intro', 'second', 'first', 'outside'].map((id) => ({
    id, title: `Title ${id}`, description: `Description ${id}`, path: `docs/${id}.md`, format: 'markdown',
  }))
  const collection: ContentCollection = { id: 'essays', title: 'Ensayos sin traducir', intro: 'intro', documents: ['second', 'first'] }
  const content = {
    getDocument: vi.fn((id: string) => documents.find((document) => document.id === id)),
    getCollection: vi.fn((id: string) => id === collection.id ? collection : undefined),
    getMarkdown: vi.fn(async (id: string) => `# ${id}\nContenido sin traducir.`),
  } satisfies ContentService
  const registry = new CommandRegistry([
    { name: 'about', type: 'document', description: 'Sobre mí', content: 'intro', aliases: ['bio'] },
    { name: 'essays', type: 'collection', description: 'Ensayos', collection: 'essays', aliases: ['blog'] },
  ])
  return { executor: new CommandExecutor({ registry, content, locale }), content, collection }
}

const context = { history: Object.freeze(['about', 'clear']) }

describe.each(['es', 'en'] as const)('CommandExecutor en %s', (locale) => {
  it('ignora entradas vacías sin consultar contenidos', async () => {
    const { executor, content } = setup(locale)
    expect(await executor.execute(' \t ', context)).toEqual([])
    expect(content.getDocument).not.toHaveBeenCalled()
    expect(content.getCollection).not.toHaveBeenCalled()
    expect(content.getMarkdown).not.toHaveBeenCalled()
  })

  it.each([
    ['help a b', 'TOO_MANY_ARGUMENTS'], ['help --all', 'UNSUPPORTED_SYNTAX'], ['help|clear', 'UNSUPPORTED_SYNTAX'],
    ['missing', 'COMMAND_NOT_FOUND'], ['ABOUT', 'COMMAND_NOT_FOUND'],
    ['about extra', 'INVALID_ARGUMENTS'], ['bio extra', 'INVALID_ARGUMENTS'],
    ['clear extra', 'INVALID_ARGUMENTS'], ['history extra', 'INVALID_ARGUMENTS'],
  ])('devuelve un error estructurado para %s', async (input, code) => {
    const { executor, content } = setup(locale)
    expect(await executor.execute(input, context)).toEqual([expect.objectContaining({ type: 'error', code, message: expect.any(String) })])
    expect(content.getMarkdown).not.toHaveBeenCalled()
    expect(content.getCollection).not.toHaveBeenCalled()
  })

  it('conecta ayuda general, específica, alias e inexistentes sin cargar contenido', async () => {
    const { executor, content } = setup(locale)
    expect(await executor.execute('help', context)).toMatchObject([{ type: 'help', scope: 'all', title: locale === 'es' ? 'Comandos disponibles' : 'Available commands' }])
    expect(await executor.execute('help bio', context)).toEqual(await executor.execute('help about', context))
    expect(await executor.execute('help missing', context)).toMatchObject([{ type: 'error', code: 'COMMAND_NOT_FOUND', message: locale === 'es' ? 'No existe el comando: missing.' : 'Command not found: missing.' }])
    expect(content.getDocument).not.toHaveBeenCalled()
    expect(content.getMarkdown).not.toHaveBeenCalled()
  })

  it('clear conserva el historial y history incluye la instrucción actual intacta', async () => {
    const { executor } = setup(locale)
    expect(await executor.execute('clear', context)).toEqual([{ type: 'clear' }])
    expect(await executor.execute('  history \t', context)).toEqual([{ type: 'history', entries: [
      { number: 1, input: 'about' }, { number: 2, input: 'clear' }, { number: 3, input: '  history \t' },
    ] }])
    expect(context.history).toEqual(['about', 'clear'])
    expect(await executor.execute('history', { history: [] })).toMatchObject([{ entries: [{ number: 1, input: 'history' }] }])
  })

  it('recupera el documento por nombre o alias y devuelve Markdown sin traducir', async () => {
    const { executor, content } = setup(locale)
    const result = await executor.execute('bio', context)
    expect(result).toEqual([{ type: 'markdown', documentId: 'intro', title: 'Title intro', markdown: '# intro\nContenido sin traducir.' }])
    expect(result).toEqual(await executor.execute('about', context))
    expect(content.getMarkdown).toHaveBeenCalledWith('intro')
  })

  it('devuelve la introducción seguida de una sugerencia localizada con nombre canónico', async () => {
    const { executor } = setup(locale)
    expect(await executor.execute('blog', context)).toEqual([
      { type: 'markdown', documentId: 'intro', title: 'Title intro', markdown: '# intro\nContenido sin traducir.' },
      { type: 'text', text: locale === 'es' ? 'Ejecuta essays list para ver todos los documentos.' : 'Run essays list to see all documents.' },
    ])
  })

  it('lista todos los documentos en el orden configurado sin descargar Markdown', async () => {
    const { executor, content } = setup(locale)
    expect(await executor.execute('blog list', context)).toEqual([{ type: 'list', title: 'Ensayos sin traducir', items: [
      { id: 'second', title: 'Title second', description: 'Description second' },
      { id: 'first', title: 'Title first', description: 'Description first' },
    ] }])
    expect(content.getMarkdown).not.toHaveBeenCalled()
  })

  it('devuelve un listado vacío para una colección sin miembros', async () => {
    const { executor, collection } = setup(locale)
    collection.documents = []
    expect(await executor.execute('essays list', context)).toEqual([{ type: 'list', title: collection.title, items: [] }])
  })

  it.each(['first', 'intro'])('recupera el miembro o introducción %s', async (id) => {
    const { executor, content } = setup(locale)
    expect(await executor.execute(`essays ${id}`, context)).toMatchObject([{ type: 'markdown', documentId: id }])
    expect(content.getMarkdown).toHaveBeenCalledWith(id)
  })

  it.each(['outside', 'missing', 'FIRST', 'List'])('rechaza un ID ajeno o diferente: %s', async (id) => {
    const { executor, content } = setup(locale)
    expect(await executor.execute(`essays ${id}`, context)).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_IN_COLLECTION', argument: id }])
    expect(content.getDocument).not.toHaveBeenCalled()
    expect(content.getMarkdown).not.toHaveBeenCalled()
  })

  it('localiza los errores de argumentos', async () => {
    const { executor } = setup(locale)
    expect(await executor.execute('clear x', context)).toMatchObject([{ message: locale === 'es' ? 'Este comando no acepta argumentos.' : 'This command does not accept arguments.' }])
  })
})

describe('fallos y asincronía del servicio de contenidos', () => {
  it('espera al servicio antes de devolver Markdown', async () => {
    const { executor, content } = setup()
    let complete!: (markdown: string) => void
    content.getMarkdown.mockImplementation(() => new Promise((resolve) => { complete = resolve }))
    const finished = vi.fn()
    const pending = executor.execute('about', context).then((result) => { finished(); return result })
    expect(finished).not.toHaveBeenCalled()
    complete('# Asíncrono')
    expect(await pending).toMatchObject([{ type: 'markdown', markdown: '# Asíncrono' }])
  })

  it.each(['about', 'essays', 'essays first'])('convierte rechazos asíncronos en error para %s', async (input) => {
    const { executor, content } = setup()
    const cause = new Error('Service unavailable')
    content.getMarkdown.mockRejectedValue(cause)
    expect(await executor.execute(input, context)).toMatchObject([{ type: 'error', code: 'CONTENT_ERROR', cause }])
    content.getMarkdown.mockResolvedValue('# Recuperado')
    expect((await executor.execute(input, context))[0]).toMatchObject({ type: 'markdown' })
  })

  it('no devuelve un listado parcial cuando falta un documento', async () => {
    const { executor, content } = setup()
    const lookup = content.getDocument.getMockImplementation()!
    content.getDocument.mockImplementation((id) => id === 'first' ? undefined : lookup(id))
    expect(await executor.execute('essays list', context)).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_FOUND', argument: 'first' }])
  })

  it('gestiona un documento o colección ausente y fallos síncronos', async () => {
    const { executor, content } = setup()
    content.getDocument.mockReturnValue(undefined)
    expect(await executor.execute('about', context)).toMatchObject([{ code: 'DOCUMENT_NOT_FOUND' }])
    expect(await executor.execute('essays', context)).toMatchObject([{ code: 'DOCUMENT_NOT_FOUND' }])
    content.getCollection.mockReturnValue(undefined)
    expect(await executor.execute('essays list', context)).toMatchObject([{ code: 'COLLECTION_NOT_FOUND' }])
    content.getCollection.mockImplementation(() => { throw new Error('broken catalog') })
    expect(await executor.execute('essays', context)).toMatchObject([{ code: 'CONTENT_ERROR' }])
  })
})

it('integra configuración validada, registro, parser, internos y contenidos sin HTTP real', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    if (String(url).endsWith('site.json')) return Response.json({ version: 1, name: 'Site', description: 'Notes', locale: 'en' })
    if (String(url).endsWith('commands.json')) return Response.json({ version: 1, commands: [
      { type: 'collection', name: 'notes', description: 'Notas', collection: 'notes', aliases: ['journal'] },
    ] })
    return Response.json({ version: 1, collections: [{ id: 'notes', title: 'Notas', intro: 'intro', documents: ['entry'] }], documents: [
      { id: 'intro', title: 'Inicio', path: 'intro.md', format: 'markdown' },
      { id: 'entry', title: 'Entrada', path: 'entry.md', format: 'markdown' },
    ] })
  })
  const config = await bootstrapConfiguration({ baseUrl: 'https://example.com/', fetch })
  const content: ContentService = {
    getDocument: (id) => config.content.documents.find((document) => document.id === id),
    getCollection: (id) => config.content.collections.find((collection) => collection.id === id),
    getMarkdown: async (id) => `# ${id}`,
  }
  const executor = new CommandExecutor({ registry: new CommandRegistry(config.commands.commands), content, locale: config.site.locale })
  expect(await executor.execute('  journal  entry ', { history: [] })).toMatchObject([{ type: 'markdown', markdown: '# entry' }])
  expect(await executor.execute('help journal', { history: [] })).toMatchObject([{ type: 'help', title: 'Help for notes' }])
  expect(await executor.execute('journal', { history: [] })).toMatchObject([{ type: 'markdown' }, { type: 'text', text: 'Run notes list to see all documents.' }])
  expect(fetch).toHaveBeenCalledTimes(3)
})
