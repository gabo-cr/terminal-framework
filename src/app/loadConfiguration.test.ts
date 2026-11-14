import { afterEach, expect, it, vi } from 'vitest'
import { loadConfiguration } from './loadConfiguration'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('lee la raíz desde Vite y la pasa al cargador sin depender de React', async () => {
  vi.stubEnv('VITE_CONTENT_BASE_URL', 'https://example.com/root')
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    if (String(url).endsWith('/site.json')) {
      return Response.json({ version: 1, name: 'Prueba', description: 'Arranque' })
    }
    return Response.json(String(url).endsWith('/commands.json')
      ? { version: 1, commands: [] } : { version: 1, collections: [], documents: [] })
  })
  vi.stubGlobal('fetch', fetch)
  await expect(loadConfiguration()).resolves.toHaveProperty('site.name', 'Prueba')
  expect(fetch.mock.calls[0]?.[0]).toBe('https://example.com/root/config/site.json')
})

it('rechaza HTTP local en producción', async () => {
  vi.stubEnv('VITE_CONTENT_BASE_URL', 'http://localhost:8080')
  vi.stubEnv('DEV', false)
  await expect(loadConfiguration()).rejects.toMatchObject({ kind: 'invalid-base-url', code: 'INVALID_BASE_URL' })
})
