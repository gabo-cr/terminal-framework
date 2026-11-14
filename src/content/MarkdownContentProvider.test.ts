import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContentCatalog } from './ContentCatalog'
import { ContentError } from './ContentError'
import { MarkdownContentProvider } from './MarkdownContentProvider'

const baseUrl = 'https://example.com/remote/content/'
const documentUrl = `${baseUrl}documents/intro.md`
function catalog(path = 'documents/intro.md') {
  return new ContentCatalog({ version: 1, collections: [], documents: [
    { id: 'intro', title: 'Inicio', format: 'markdown', path },
  ] })
}

afterEach(() => vi.unstubAllGlobals())

describe('MarkdownContentProvider', () => {
  it('consulta el catálogo y descarga mediante GET público sin seguir redirecciones', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('# Inicio'))
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    expect(await provider.getMarkdown('intro')).toBe('# Inicio')
    expect(fetch).toHaveBeenCalledExactlyOnceWith(documentUrl, {
      method: 'GET', credentials: 'omit', redirect: 'error',
    })
  })

  it.each([
    '', '  # Título\r\n\r\nTexto con espacios al final.  \r\n',
    '# Ingeniería y poesía\n\n¿Ñandú? ¡Sí! 漢字 🚀\n',
    '<script>example()</script>\n**negrita** & < > " comillas\n```ts\nconst x = 1\n```\n',
  ])('conserva exactamente el texto recibido: %j', async (markdown) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(markdown))
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    expect(await provider.getMarkdown('intro')).toBe(markdown)
  })

  it('rechaza un ID inexistente antes de acceder a la red', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    await expect(provider.getMarkdown('missing')).rejects.toMatchObject({
      code: 'DOCUMENT_NOT_FOUND', documentId: 'missing',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([404, 500])('rechaza HTTP %i antes de leer el cuerpo', async (status) => {
    const response = new Response('Error body', { status })
    const text = vi.spyOn(response, 'text')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    await expect(provider.getMarkdown('intro')).rejects.toMatchObject({
      name: 'ContentError', code: 'HTTP_ERROR', status, documentId: 'intro', url: documentUrl,
    })
    expect(text).not.toHaveBeenCalled()
  })

  it('conserva la causa de un error de red', async () => {
    const cause = new TypeError('Failed to fetch')
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(cause)
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    await expect(provider.getMarkdown('intro')).rejects.toBeInstanceOf(ContentError)
    await expect(provider.getMarkdown('intro')).rejects.toMatchObject({
      code: 'NETWORK_ERROR', cause, documentId: 'intro', url: documentUrl,
    })
  })

  it('clasifica un fallo de lectura como red y no devuelve texto parcial', async () => {
    const cause = new Error('Connection interrupted')
    const response = new Response()
    vi.spyOn(response, 'text').mockRejectedValue(cause)
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    await expect(provider.getMarkdown('intro')).rejects.toMatchObject({ code: 'NETWORK_ERROR', cause })
  })

  it.each([
    'https://outside.test/file.md', '//outside.test/file.md', '/absolute.md', '../file.md',
    'docs/../file.md', 'file.md?token=secret', 'file.md#part', 'docs\\file.md',
    '%2e%2e/file.md', '%252e%252e/file.md', 'docs%2ffile.md',
  ])('bloquea rutas no permitidas antes de descargar: %s', async (path) => {
    // Catálogo alterado simulado: comprobar que la barrera de URL se aplica al descargar.
    const fetch = vi.fn<typeof globalThis.fetch>()
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(path), fetch })
    await expect(provider.getMarkdown('intro')).rejects.toMatchObject({
      code: 'UNSAFE_PATH', documentId: 'intro', cause: expect.objectContaining({ code: 'UNSAFE_PATH' }),
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('resuelve nombres de archivo Unicode sin restringirse a un proveedor de hosting', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('Texto'))
    const provider = new MarkdownContentProvider({ baseUrl: 'https://static.example.org:8443/archive/', catalog: catalog('literatura/niñez.md'), fetch })
    await provider.getMarkdown('intro')
    expect(fetch.mock.calls[0]?.[0]).toBe('https://static.example.org:8443/archive/literatura/ni%C3%B1ez.md')
  })

  it('mantiene HTTP limitado al desarrollo local por las reglas existentes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('Local'))
    const options = { baseUrl: 'http://localhost:8080/content/', catalog: catalog(), fetch }
    expect(() => new MarkdownContentProvider(options)).toThrow(expect.objectContaining({ code: 'INVALID_BASE_URL' }))
    expect(() => new MarkdownContentProvider({ ...options, baseUrl: 'https://user:secret@example.com/' }))
      .toThrow(expect.objectContaining({ code: 'INVALID_BASE_URL' }))
    await new MarkdownContentProvider({ ...options, development: true }).getMarkdown('intro')
    expect(fetch.mock.calls[0]?.[0]).toBe('http://localhost:8080/content/documents/intro.md')
  })

  it('no cachea ni agrupa descargas de un mismo ID', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('Primero')).mockResolvedValueOnce(new Response('Segundo'))
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog(), fetch })
    expect(await provider.getMarkdown('intro')).toBe('Primero')
    expect(await provider.getMarkdown('intro')).toBe('Segundo')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('puede utilizar el fetch global sin requerir un cliente HTTP específico', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('Global'))
    vi.stubGlobal('fetch', fetch)
    const provider = new MarkdownContentProvider({ baseUrl, catalog: catalog() })
    expect(await provider.getMarkdown('intro')).toBe('Global')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
