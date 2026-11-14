/// <reference types="node" />
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { createFixtureServer, fixtureDirectory } from '../support/serve-fixtures'
import { loadApplication } from '../../src/app/loadApplication'
import { loadConfiguration } from '../../src/app/loadConfiguration'

let directory: string
let server: ReturnType<typeof createFixtureServer>
let baseUrl: string
let application: Awaited<ReturnType<typeof loadApplication>>
const requests: string[] = []
const context = { history: Object.freeze(['about', 'contact']) }

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'terminal-framework-fixtures-'))
  await cp(fixtureDirectory, directory, { recursive: true })
  server = createFixtureServer(directory)
  server.on('request', (request) => requests.push(request.url ?? ''))
  const listening = once(server, 'listening')
  server.listen(0, '127.0.0.1')
  await listening
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No HTTP address')
  baseUrl = `http://127.0.0.1:${address.port}/`
})

beforeEach(async () => {
  requests.length = 0
  vi.stubEnv('VITE_CONTENT_BASE_URL', baseUrl)
  vi.stubEnv('DEV', true)
  application = await loadApplication()
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => {
  if (server) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function original(path: string) {
  return readFile(join(directory, 'documents', path), 'utf8')
}
const execute = (input: string) => application.executor.execute(input, context)

describe('sitio externo sobre HTTP real', () => {
  it('resuelve los tres JSON mediante VITE_CONTENT_BASE_URL sin descargar Markdown al arrancar', async () => {
    expect(requests.slice().sort()).toEqual(['/config/site.json', '/config/commands.json', '/config/content.json'].sort())
    expect(application.configuration.site.name).toBe('Cuaderno de ejemplo')
    expect(application.configuration.site.theme.accentColor).toBe('#96D9A5')
    expect(await loadConfiguration()).toEqual(application.configuration)
  })

  it.each([
    ['about', 'about', 'about.md'], ['contact', 'contact', 'contact.md'],
    ['code react-hooks', 'react-hooks', 'react-hooks.md'], ['read cuento-001', 'cuento-001', 'cuento-001.md'],
  ])('%s devuelve el Markdown real', async (input, documentId, path) => {
    expect(await execute(input)).toMatchObject([{ type: 'markdown', documentId, markdown: await original(path) }])
    expect(requests).toContain(`/documents/${path}`)
  })

  it.each([['code', 'workshop.md'], ['read', 'library.md']])('%s devuelve introducción y sugerencia', async (input, path) => {
    expect(await execute(input)).toMatchObject([
      { type: 'markdown', markdown: await original(path) },
      { type: 'text', text: `Ejecuta ${input} list para ver todos los documentos.` },
    ])
  })

  it.each([
    ['code list', ['typescript-notes', 'react-hooks']], ['read list', ['cuento-002', 'cuento-001']],
  ])('%s respeta el orden completo sin descargar cuerpos', async (input, ids) => {
    expect(await execute(input)).toMatchObject([{ type: 'list', items: ids.map((id) => ({ id })) }])
    expect(requests.filter((path) => path.endsWith('.md'))).toEqual([])
  })

  it('rechaza documentos ajenos antes de acceder a HTTP', async () => {
    expect(await execute('code cuento-001')).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_IN_COLLECTION' }])
    expect(await execute('read react-hooks')).toMatchObject([{ type: 'error', code: 'DOCUMENT_NOT_IN_COLLECTION' }])
    expect(requests.filter((path) => path.endsWith('.md'))).toEqual([])
  })

  it('reutiliza la caché por ID al repetir la consulta o usar un alias', async () => {
    const first = await execute('about')
    expect(await execute('about')).toEqual(first)
    expect(await execute('acerca')).toEqual(first)
    expect(requests.filter((path) => path === '/documents/about.md')).toHaveLength(1)
  })

  it('un 404 remoto es recuperable cuando el archivo se publica después del fallo', async () => {
    expect(await execute('missing')).toMatchObject([{ type: 'error', code: 'CONTENT_ERROR', cause: { code: 'HTTP_ERROR', status: 404 } }])
    const path = join(directory, 'documents/remote-missing.md')
    try {
      await writeFile(path, '# Publicado tras el error\n')
      expect(await execute('missing')).toMatchObject([{ type: 'markdown', markdown: '# Publicado tras el error\n' }])
      await execute('missing')
      expect(requests.filter((path) => path === '/documents/remote-missing.md')).toHaveLength(2)
    } finally { await rm(path, { force: true }) }
  })

  it('mantiene help, clear e history sin borrar caché ni historial', async () => {
    expect(await execute('help')).toMatchObject([{ type: 'help', commands: [
      { name: 'help' }, { name: 'clear' }, { name: 'history' }, { name: 'about' },
      { name: 'contact' }, { name: 'code' }, { name: 'read' }, { name: 'missing' },
    ] }])
    await execute('about')
    expect(await execute('clear')).toEqual([{ type: 'clear' }])
    await execute('about')
    expect(requests.filter((path) => path === '/documents/about.md')).toHaveLength(1)
    expect(await execute('history')).toEqual([{ type: 'history', entries: [
      { number: 1, input: 'about' }, { number: 2, input: 'contact' }, { number: 3, input: 'history' },
    ] }])
    expect(context.history).toEqual(['about', 'contact'])
  })
})
