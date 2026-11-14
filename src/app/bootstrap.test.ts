import { describe, expect, it, vi } from 'vitest'
import { bootstrapConfiguration } from './bootstrap'

function fixtures() {
  return {
    site: { version: 1, name: 'Sitio', description: 'Ideas' },
    commands: { version: 1, commands: [{ type: 'document', name: 'about', description: 'Inicio', content: 'intro' }] },
    content: { version: 1, collections: [{ id: 'essays', title: 'Ensayos', intro: 'intro', documents: ['intro'] }],
      documents: [{ id: 'intro', title: 'Inicio', path: 'docs/intro.md', format: 'markdown' }] },
  }
}

function mockFetch(data: ReturnType<typeof fixtures>) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const filename = new URL(String(input)).pathname.split('/').at(-1)
    const key = filename?.replace('.json', '') as keyof typeof data
    return Response.json(data[key])
  })
}

describe('bootstrapConfiguration', () => {
  it('devuelve la configuración completa con defaults y solo descarga los tres JSON', async () => {
    const fetch = mockFetch(fixtures())
    const result = await bootstrapConfiguration({ baseUrl: 'https://example.com/root', fetch })
    expect(result.site.locale).toBe('es')
    expect(result.site.terminal.welcome).toContain('Bienvenido')
    expect(result.site.theme).toEqual({ accentColor: '#96D9A5', terminalBackground: '#292C32' })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://example.com/root/config/site.json', 'https://example.com/root/config/commands.json',
      'https://example.com/root/config/content.json',
    ])
  })

  it('no alcanza ready si falla una referencia', async () => {
    const data = fixtures()
    data.commands.commands[0]!.content = 'missing'
    const ready = vi.fn()
    const loading = bootstrapConfiguration({ baseUrl: 'https://example.com', fetch: mockFetch(data) }).then(ready)
    await expect(loading).rejects.toMatchObject({
      code: 'CROSS_VALIDATION_ERROR', details: [expect.objectContaining({ code: 'DOCUMENT_NOT_FOUND' })],
    })
    expect(ready).not.toHaveBeenCalled()
  })

  it('rechaza repeticiones estructurales antes de devolver configuración', async () => {
    const data = fixtures()
    data.content.collections[0]!.documents.push('intro')
    await expect(bootstrapConfiguration({ baseUrl: 'https://example.com', fetch: mockFetch(data) }))
      .rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_ERROR', cause: expect.any(Error) })
  })

  it.each(['network', 'http', 'json', 'schema', 'base'] as const)('propaga errores de %s sin alcanzar ready', async (failure) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      if (failure === 'network') throw new TypeError('offline')
      if (failure === 'http') return new Response('', { status: 404 })
      if (failure === 'json') return new Response('{')
      return Response.json({ version: 2 })
    })
    const codes = { network: 'NETWORK_ERROR', http: 'HTTP_ERROR', json: 'INVALID_JSON',
      schema: 'SCHEMA_VALIDATION_ERROR', base: 'INVALID_BASE_URL' }
    const ready = vi.fn()
    const loading = bootstrapConfiguration({ baseUrl: failure === 'base' ? '' : 'https://example.com', fetch }).then(ready)
    await expect(loading).rejects.toMatchObject({ code: codes[failure] })
    expect(ready).not.toHaveBeenCalled()
  })
})
