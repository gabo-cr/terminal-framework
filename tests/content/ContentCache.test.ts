import { describe, expect, it, vi } from 'vitest'
import { ContentCache } from '../../src/content/ContentCache'
import { ContentCatalog } from '../../src/content/ContentCatalog'
import { MarkdownContentProvider } from '../../src/content/MarkdownContentProvider'

function deferred() {
  let resolve!: (value: string) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<string>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('ContentCache', () => {
  it('consulta al proveedor una vez y reutiliza el Markdown exacto posteriormente', async () => {
    const markdown = '  # Ingeniería 🚀\r\n\n**Texto**  '
    const provider = { getMarkdown: vi.fn(async () => markdown) }
    const cache = new ContentCache(provider)
    const first = cache.getMarkdown('intro')
    expect(await first).toBe(markdown)
    const second = cache.getMarkdown('intro')
    expect(second).toBe(first)
    expect(await second).toBe(markdown)
    expect(provider.getMarkdown).toHaveBeenCalledExactlyOnceWith('intro')
  })

  it('reutiliza también un documento cuyo cuerpo está vacío', async () => {
    const provider = { getMarkdown: vi.fn(async () => '') }
    const cache = new ContentCache(provider)
    expect(await cache.getMarkdown('empty')).toBe('')
    expect(await cache.getMarkdown('empty')).toBe('')
    expect(provider.getMarkdown).toHaveBeenCalledTimes(1)
  })

  it('comparte exactamente una Promise entre consultas simultáneas', async () => {
    const download = deferred()
    const provider = { getMarkdown: vi.fn(() => download.promise) }
    const cache = new ContentCache(provider)
    const first = cache.getMarkdown('intro')
    const second = cache.getMarkdown('intro')
    expect(second).toBe(first)
    await Promise.resolve()
    expect(provider.getMarkdown).toHaveBeenCalledTimes(1)
    download.resolve('# Intro')
    expect(await Promise.all([first, second])).toEqual(['# Intro', '# Intro'])
  })

  it('comparte el rechazo original, elimina la entrada fallida y permite reintentar', async () => {
    const download = deferred()
    const error = new Error('Falló la descarga')
    const provider = { getMarkdown: vi.fn().mockReturnValueOnce(download.promise).mockResolvedValueOnce('# Recuperado') }
    const cache = new ContentCache(provider)
    const first = cache.getMarkdown('intro')
    const second = cache.getMarkdown('intro')
    const results = Promise.allSettled([first, second])
    download.reject(error)
    expect(await results).toEqual([{ status: 'rejected', reason: error }, { status: 'rejected', reason: error }])
    const retry = cache.getMarkdown('intro')
    expect(retry).not.toBe(first)
    expect(await retry).toBe('# Recuperado')
    expect(await cache.getMarkdown('intro')).toBe('# Recuperado')
    expect(provider.getMarkdown).toHaveBeenCalledTimes(2)
  })

  it('permite reintentar incluso si el proveedor lanza un error síncrono', async () => {
    const error = new Error('Error síncrono')
    const provider = { getMarkdown: vi.fn<() => Promise<string>>()
      .mockImplementationOnce(() => { throw error }).mockResolvedValueOnce('OK') }
    const cache = new ContentCache(provider)
    await expect(cache.getMarkdown('intro')).rejects.toBe(error)
    expect(await cache.getMarkdown('intro')).toBe('OK')
  })

  it('limpia todos los documentos y solicita otra vez los cuerpos después de clear', async () => {
    const provider = { getMarkdown: vi.fn(async (id: string) => `# ${id}`) }
    const cache = new ContentCache(provider)
    await Promise.all([cache.getMarkdown('first'), cache.getMarkdown('second')])
    cache.clear()
    await Promise.all([cache.getMarkdown('first'), cache.getMarkdown('second')])
    expect(provider.getMarkdown.mock.calls.map(([id]) => id)).toEqual(['first', 'second', 'first', 'second'])
  })

  it('mantiene documentos independientes aunque uno falle', async () => {
    const error = new Error('No disponible')
    const provider = { getMarkdown: vi.fn(async (id: string) => {
      if (id === 'broken') throw error
      return `# ${id}`
    }) }
    const cache = new ContentCache(provider)
    const success = cache.getMarkdown('good')
    const failure = cache.getMarkdown('broken')
    await expect(failure).rejects.toBe(error)
    expect(await success).toBe('# good')
    expect(cache.getMarkdown('good')).toBe(success)
    await expect(cache.getMarkdown('broken')).rejects.toBe(error)
    expect(provider.getMarkdown.mock.calls.map(([id]) => id)).toEqual(['good', 'broken', 'broken'])
  })

  it('una descarga completada tras clear no repuebla la caché ni sustituye el nuevo resultado', async () => {
    const old = deferred()
    const provider = { getMarkdown: vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce('Nuevo') }
    const cache = new ContentCache(provider)
    const previous = cache.getMarkdown('intro')
    await Promise.resolve()
    cache.clear()
    const current = cache.getMarkdown('intro')
    expect(await current).toBe('Nuevo')
    old.resolve('Anterior')
    expect(await previous).toBe('Anterior')
    expect(cache.getMarkdown('intro')).toBe(current)
    expect(await cache.getMarkdown('intro')).toBe('Nuevo')
  })

  it('un rechazo posterior a clear no elimina la nueva solicitud del mismo ID', async () => {
    const old = deferred()
    const fresh = deferred()
    const error = new Error('Fallo antiguo')
    const provider = { getMarkdown: vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise) }
    const cache = new ContentCache(provider)
    const previous = cache.getMarkdown('intro')
    const rejected = expect(previous).rejects.toBe(error)
    await Promise.resolve()
    cache.clear()
    const current = cache.getMarkdown('intro')
    old.reject(error)
    await rejected
    expect(cache.getMarkdown('intro')).toBe(current)
    fresh.resolve('Actual')
    expect(await current).toBe('Actual')
    expect(provider.getMarkdown).toHaveBeenCalledTimes(2)
  })

  it('compone proveedor y catálogo manteniendo aislamiento entre raíces para el mismo ID', async () => {
    const catalog = new ContentCatalog({ version: 1, collections: [], documents: [
      { id: 'intro', title: 'Intro', path: 'intro.md', format: 'markdown' },
    ] })
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => new Response(String(url)))
    const first = new ContentCache(new MarkdownContentProvider({ baseUrl: 'https://example.com/first/', catalog, fetch }))
    const second = new ContentCache(new MarkdownContentProvider({ baseUrl: 'https://example.com/second/', catalog, fetch }))
    expect(await first.getMarkdown('intro')).toBe('https://example.com/first/intro.md')
    expect(await second.getMarkdown('intro')).toBe('https://example.com/second/intro.md')
    await first.getMarkdown('intro')
    first.clear()
    await second.getMarkdown('intro')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
