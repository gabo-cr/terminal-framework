import { describe, expect, it, vi } from 'vitest'
import { ConfigurationLoader } from '../../src/configuration/ConfigurationLoader'
import { ConfigurationError } from '../../src/configuration/ConfigurationError'

const baseUrl = 'https://example.com/content'
const fixtures: Record<string, unknown> = {
  'site.json': { version: 1, name: 'Sitio', description: 'Ideas' },
  'commands.json': { version: 1, commands: [] },
  'content.json': { version: 1, collections: [], documents: [] },
}

function validResponse(url: string | URL | Request) {
  const file = String(url).split('/').at(-1)!
  return Response.json(fixtures[file])
}

describe('ConfigurationLoader', () => {
  it('descarga las tres rutas correctas y aplica los esquemas existentes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => validResponse(url))
    const loader = new ConfigurationLoader({ baseUrl, fetch })
    const result = await loader.load()
    expect(loader.baseUrl).toBe(`${baseUrl}/`)
    expect(result.site).toMatchObject({ name: 'Sitio', locale: 'es', theme: { accentColor: '#96D9A5' } })
    expect(result.commands).toEqual(fixtures['commands.json'])
    expect(result.content).toEqual(fixtures['content.json'])
    expect(fetch.mock.calls).toEqual(['site', 'commands', 'content'].map((name) => [
      `${baseUrl}/config/${name}.json`, { redirect: 'error', credentials: 'omit' },
    ]))
  })

  it('inicia las tres descargas antes de que ninguna termine', async () => {
    const complete: (() => void)[] = []
    const fetch = vi.fn<typeof globalThis.fetch>((url) => new Promise((resolve) => {
      complete.push(() => resolve(validResponse(url)))
    }))
    const loading = new ConfigurationLoader({ baseUrl, fetch }).load()
    expect(fetch).toHaveBeenCalledTimes(3)
    complete.forEach((resolve) => resolve())
    await expect(loading).resolves.toHaveProperty('site.name', 'Sitio')
  })

  it('rechaza una URL inválida antes de iniciar descargas', () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    expect(() => new ConfigurationLoader({ baseUrl: undefined, fetch })).toThrow(ConfigurationError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('admite una raíz HTTP local mediante una opción explícita', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => validResponse(url))
    await new ConfigurationLoader({ baseUrl: 'http://localhost:8080', development: true, fetch }).load()
    expect(fetch.mock.calls[0]?.[0]).toBe('http://localhost:8080/config/site.json')
  })

  it.each(['site.json', 'commands.json', 'content.json'])('rechaza todo el resultado si %s devuelve 404', async (file) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => String(url).endsWith(file)
      ? new Response('Not Found', { status: 404 }) : validResponse(url))
    await expect(new ConfigurationLoader({ baseUrl, fetch }).load()).rejects.toMatchObject({
      kind: 'http', status: 404, url: `${baseUrl}/config/${file}`,
    })
  })

  it('distingue JSON mal formado', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{broken'))
    await expect(new ConfigurationLoader({ baseUrl, fetch }).load()).rejects.toMatchObject({
      kind: 'invalid-json', cause: expect.any(SyntaxError),
    })
  })

  it('distingue JSON válido que incumple el esquema', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ version: 2 }))
    await expect(new ConfigurationLoader({ baseUrl, fetch }).load()).rejects.toMatchObject({ kind: 'validation' })
  })

  it('distingue fallos de red y conserva la causa', async () => {
    const cause = new TypeError('Failed to fetch')
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(cause)
    await expect(new ConfigurationLoader({ baseUrl, fetch }).load()).rejects.toMatchObject({ kind: 'network', cause })
  })

  it('clasifica un fallo al leer el cuerpo como red, no como JSON inválido', async () => {
    const cause = new TypeError('Connection lost')
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      const response = new Response()
      vi.spyOn(response, 'text').mockRejectedValue(cause)
      return response
    })
    await expect(new ConfigurationLoader({ baseUrl, fetch }).load()).rejects.toMatchObject({ kind: 'network', cause })
  })
})
