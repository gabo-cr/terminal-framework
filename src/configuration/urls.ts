import { ConfigurationError } from './ConfigurationError'

// Se decodifica una sola vez; porcentajes residuales se rechazan para evitar
// interpretaciones diferentes por servidores que decodifican más de una vez.
function safeSegments(path: string): boolean {
  return path.split('/').every((segment) => {
    try {
      const decoded = decodeURIComponent(segment)
      return decoded !== '' && decoded !== '.' && decoded !== '..'
        && !/[\\/:?#%\u0000-\u0020\u007f]/.test(decoded)
    } catch {
      return false
    }
  })
}

export function normalizeContentBaseUrl(
  value: string | undefined,
  development = false,
): string {
  const invalid = () => new ConfigurationError(
    'invalid-base-url',
    'VITE_CONTENT_BASE_URL debe ser una URL HTTPS absoluta; HTTP solo se admite en desarrollo local.',
  )
  if (!value) throw invalid()
  const input = value.trim()
  if (!/^https?:\/\//i.test(input) || /[\\?#\u0000-\u0020\u007f]/.test(input)) throw invalid()

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw invalid()
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || (url.protocol !== 'https:'
    && !(url.protocol === 'http:' && development && local))) throw invalid()

  // Revisar el path original: URL normaliza los segmentos '..' silenciosamente.
  const rawPath = input.replace(/^https?:\/\/[^/]+/i, '')
  if (rawPath !== '' && rawPath !== '/'
    && !safeSegments(rawPath.slice(1).replace(/\/$/, ''))) throw invalid()
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url.href
}

export function resolveSafeRelativeUrl(baseUrl: string, path: string, development = false): string {
  const base = new URL(normalizeContentBaseUrl(baseUrl, development))
  if (!safeSegments(path)) {
    throw new ConfigurationError('unsafe-path', `Ruta relativa no permitida: ${path}`)
  }
  const resolved = new URL(path, base)
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)
    || resolved.search || resolved.hash) {
    throw new ConfigurationError('unsafe-path', `La ruta sale de la raíz configurada: ${path}`)
  }
  return resolved.href
}
