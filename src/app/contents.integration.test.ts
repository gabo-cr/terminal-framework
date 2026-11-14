import { afterEach, describe, expect, it, vi } from 'vitest'
import { bootstrapApplication } from './bootstrapApplication'
import type { CommandLocale } from '../core/commandResults'
import { ContentError } from '../content/ContentError'

const baseUrl = 'https://example.com/public/archive/'
const context = { history: Object.freeze(['read', 'clear']) }

async function setup(locale: CommandLocale = 'es') {
  const bodies = new Map(['intro', 'first', 'second', 'outside'].map((id) => [
    id, `# ${id}\r\n\nContenido ficticio: ñ, 漢字 y 🚀.  `,
  ]))
  const statuses = new Map<string, number>()
  const failures = new Set<string>()
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/config/site.json')) return Response.json({ version: 1, name: 'Pruebas', description: 'Ficción', locale })
    if (url.pathname.endsWith('/config/commands.json')) return Response.json({ version: 1, commands: [
      { type: 'document', name: 'read', description: 'Lectura sin traducir', content: 'intro', aliases: ['open'] },
      { type: 'collection', name: 'notes', description: 'Notas', collection: 'notes', aliases: ['journal'] },
      { type: 'collection', name: 'other', description: 'Otra colección', collection: 'other' },
    ] })
    if (url.pathname.endsWith('/config/content.json')) return Response.json({ version: 1,
      collections: [
        { id: 'notes', title: 'Notas', intro: 'intro', documents: ['second', 'first'] },
        { id: 'other', title: 'Otra colección', intro: 'intro', documents: ['second'] },
      ],
      documents: [...bodies.keys()].map((id) => ({ id, title: `Título ${id}`, path: `documents/${id}.md`, format: 'markdown' })),
    })
    const id = url.pathname.split('/').at(-1)!.replace('.md', '')
    if (failures.has(id)) throw new TypeError('Fallo de red simulado')
    return new Response(bodies.get(id) ?? 'Not Found', { status: statuses.get(id) ?? (bodies.has(id) ? 200 : 404) })
  })
  const application = await bootstrapApplication({ baseUrl, fetch })
  const downloads = () => fetch.mock.calls.filter(([url]) => String(url).endsWith('.md'))
  return { ...application, fetch, bodies, statuses, failures, downloads }
}

afterEach(() => vi.unstubAllGlobals())

describe.each(['es', 'en'] as const)('contenidos reales con motor en %s', (locale) => {
  it('arranca con solo tres JSON y reutiliza un documento mediante nombres, alias y colecciones', async () => {
    const app = await setup(locale)
    expect(app.fetch).toHaveBeenCalledTimes(3)
    expect(app.downloads()).toEqual([])
    expect(await app.executor.execute('open', context)).toEqual([{
      type: 'markdown', documentId: 'intro', title: 'Título intro', markdown: app.bodies.get('intro'),
    }])
    await app.executor.execute('read', context)
    expect(await app.executor.execute('journal', context)).toEqual([
      { type: 'markdown', documentId: 'intro', title: 'Título intro', markdown: app.bodies.get('intro') },
      { type: 'text', text: locale === 'es' ? 'Ejecuta notes list para ver todos los documentos.' : 'Run notes list to see all documents.' },
    ])
    await app.executor.execute('notes intro', context)
    await app.executor.execute('other', context)
    expect(app.downloads()).toEqual([[`${baseUrl}documents/intro.md`, { method: 'GET', credentials: 'omit', redirect: 'error' }]])
  })

  it('lista el catálogo completo en orden y comprueba pertenencia antes de descargar', async () => {
    const app = await setup(locale)
    expect(await app.executor.execute('journal list', context)).toEqual([{ type: 'list', title: 'Notas', items: [
      { id: 'second', title: 'Título second', description: undefined },
      { id: 'first', title: 'Título first', description: undefined },
    ] }])
    expect(await app.executor.execute('notes outside', context)).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_IN_COLLECTION' }])
    expect(await app.executor.execute('notes missing', context)).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_IN_COLLECTION' }])
    expect(app.downloads()).toHaveLength(0)
    expect(await app.executor.execute('notes second', context)).toMatchObject([{ type: 'markdown', documentId: 'second' }])
    await app.executor.execute('other second', context)
    expect(app.downloads()).toHaveLength(1)
    expect(app.downloads()[0]?.[0]).toBe(`${baseUrl}documents/second.md`)
  })

  it.each(['read extra', 'open extra'])('rechaza argumentos de document sin acceder a Markdown: %s', async (input) => {
    const app = await setup(locale)
    expect(await app.executor.execute(input, context)).toMatchObject([{ type: 'error', code: 'INVALID_ARGUMENTS',
      message: locale === 'es' ? 'Este comando no acepta argumentos.' : 'This command does not accept arguments.' }])
    expect(app.downloads()).toHaveLength(0)
  })

  it('mantiene help, clear e history y no vacía la caché al limpiar la salida visual', async () => {
    const app = await setup(locale)
    expect(await app.executor.execute('help', context)).toMatchObject([{ type: 'help', title: locale === 'es' ? 'Comandos disponibles' : 'Available commands' }])
    expect(await app.executor.execute('help open', context)).toMatchObject([{ type: 'help', commands: [{ name: 'read', description: 'Lectura sin traducir' }] }])
    await app.executor.execute('read', context)
    expect(await app.executor.execute('clear', context)).toEqual([{ type: 'clear' }])
    expect(await app.executor.execute('  history  ', context)).toEqual([{ type: 'history', entries: [
      { number: 1, input: 'read' }, { number: 2, input: 'clear' }, { number: 3, input: '  history  ' },
    ] }])
    await app.executor.execute('open', context)
    expect(app.downloads()).toHaveLength(1)
    app.content.clearCache()
    await app.executor.execute('read', context)
    expect(app.downloads()).toHaveLength(2)
    expect(context.history).toEqual(['read', 'clear'])
  })

  it.each([404, 500])('un HTTP %i devuelve error recuperable y permite volver a ejecutar', async (status) => {
    const app = await setup(locale)
    app.statuses.set('intro', status)
    expect(await app.executor.execute('notes', context)).toEqual([expect.objectContaining({
      type: 'error', code: 'CONTENT_ERROR',
      message: locale === 'es' ? 'No se pudo cargar el contenido. Inténtalo de nuevo.' : 'Could not load the content. Please try again.',
      cause: expect.objectContaining({ code: 'HTTP_ERROR', status, documentId: 'intro', url: `${baseUrl}documents/intro.md` }),
    })])
    app.statuses.delete('intro')
    expect(await app.executor.execute('notes', context)).toMatchObject([{ type: 'markdown' }, { type: 'text' }])
    await app.executor.execute('read', context)
    expect(app.downloads()).toHaveLength(2)
  })

  it('conserva errores de red y permite reintentar después del fallo', async () => {
    const app = await setup(locale)
    app.failures.add('second')
    expect(await app.executor.execute('notes second', context)).toMatchObject([{ type: 'error', code: 'CONTENT_ERROR', cause: { code: 'NETWORK_ERROR' } }])
    app.failures.delete('second')
    expect(await app.executor.execute('notes second', context)).toMatchObject([{ type: 'markdown', documentId: 'second' }])
    expect(app.downloads()).toHaveLength(2)
  })

  it('rechaza IDs inexistentes en el servicio y mantiene operativo el motor', async () => {
    const app = await setup(locale)
    await expect(app.content.getMarkdown('missing')).rejects.toBeInstanceOf(ContentError)
    await expect(app.content.getMarkdown('missing')).rejects.toMatchObject({ code: 'DOCUMENT_NOT_FOUND' })
    expect(await app.executor.execute('missing', context)).toMatchObject([{ code: 'COMMAND_NOT_FOUND',
      message: locale === 'es' ? 'No existe el comando: missing.' : 'Command not found: missing.' }])
    expect(await app.executor.execute('read', context)).toMatchObject([{ type: 'markdown' }])
    expect(app.downloads()).toHaveLength(1)
  })
})

it('comparte la descarga entre ejecuciones simultáneas y conserva servicios independientes entre sesiones', async () => {
  const app = await setup()
  let complete!: (response: Response) => void
  app.fetch.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
  const first = app.executor.execute('read', context)
  const second = app.executor.execute('notes', context)
  await Promise.resolve()
  expect(app.downloads()).toHaveLength(1)
  complete(new Response('# Una sola descarga'))
  expect(await first).toMatchObject([{ markdown: '# Una sola descarga' }])
  expect(await second).toMatchObject([{ markdown: '# Una sola descarga' }, { type: 'text' }])
  await app.executor.execute('open', context)
  expect(app.downloads()).toHaveLength(1)
  const nextSession = await setup()
  expect(nextSession.content).not.toBe(app.content)
  await nextSession.executor.execute('read', context)
  expect(nextSession.downloads()).toHaveLength(1)
})

it('no crea un motor con configuración inválida ni solicita Markdown durante el bootstrap fallido', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ version: 2 }))
  await expect(bootstrapApplication({ baseUrl, fetch })).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_ERROR' })
  expect(fetch.mock.calls.every(([url]) => String(url).endsWith('.json'))).toBe(true)
})
