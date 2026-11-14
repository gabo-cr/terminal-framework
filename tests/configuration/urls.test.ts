import { describe, expect, it } from 'vitest'
import { normalizeContentBaseUrl, resolveSafeRelativeUrl } from '../../src/configuration/urls'

describe('URL raíz', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    [' HTTPS://EXAMPLE.COM:443/content ', 'https://example.com/content/'],
    ['https://example.com/content/', 'https://example.com/content/'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizeContentBaseUrl(input)).toBe(expected)
  })

  it.each(['localhost', '127.0.0.1', '[::1]'])('admite HTTP en %s solo en desarrollo', (host) => {
    const url = `http://${host}:8080/content`
    expect(normalizeContentBaseUrl(url, true)).toBe(`${url}/`)
    expect(() => normalizeContentBaseUrl(url)).toThrow(expect.objectContaining({ kind: 'invalid-base-url' }))
  })

  it.each([
    undefined, '', 'no-url', '/relative', '//example.com', 'ftp://example.com',
    'http://example.com', 'http://localhost.evil.test', 'https://',
    'https://user:password@example.com', 'https://example.com?x=1',
    'https://example.com#section', 'https://example.com?', 'https://example.com#',
    'https://example.com/../other', 'https://example.com/a/%2e%2e/other',
    'https://example.com/a\\b', 'https://example.com/a//b', 'https://example.com//',
    'https://example.com/a\nb', 'https://example.com/%252e%252e',
  ])('rechaza raíz inválida incluso en desarrollo: %j', (input) => {
    expect(() => normalizeContentBaseUrl(input, true)).toThrow(expect.objectContaining({ kind: 'invalid-base-url' }))
  })
})

describe('rutas relativas seguras', () => {
  it('resuelve dentro de una raíz con subdirectorio y conserva su prefijo', () => {
    expect(resolveSafeRelativeUrl('https://example.com/site', 'config/site.json'))
      .toBe('https://example.com/site/config/site.json')
  })

  it('también sirve para rutas futuras de contenido sin descargarlas', () => {
    expect(resolveSafeRelativeUrl('https://example.com/site/', 'documents/ensayo.md'))
      .toBe('https://example.com/site/documents/ensayo.md')
  })

  it.each([
    '', '/config/site.json', '//evil.test/file', 'https://evil.test/file',
    'http://evil.test/file', 'data:text/plain,hello', 'C:/file',
    '..', '.', '../file', 'config/../file', 'config/./file',
    'config//file', 'config/file?x=1', 'config/file#fragment', 'config/file?', 'config/file#',
    'config\\file', '\\evil.test/file', '%2e%2e/file', 'config/%2E%2e/file',
    '%252e%252e/file', '%2ffile', 'config%2ffile', 'config/%5cfile',
    'file%3fx=1', 'file%23fragment', 'file%00.json', 'bad%encoding',
    'file\n.json', ' file.json', 'file.json ',
  ])('rechaza %j', (path) => {
    expect(() => resolveSafeRelativeUrl('https://example.com/site/', path))
      .toThrow(expect.objectContaining({ kind: 'unsafe-path' }))
  })
})
