import { ConfigurationError } from '../configuration/ConfigurationError'
import { normalizeContentBaseUrl, resolveSafeRelativeUrl } from '../configuration/urls'
import { ContentError } from './ContentError'
import type { ContentService } from './ContentService'

export interface MarkdownContentProviderOptions {
  baseUrl: string
  catalog: Pick<ContentService, 'getDocument'>
  fetch?: typeof globalThis.fetch
  development?: boolean
}

export class MarkdownContentProvider implements Pick<ContentService, 'getMarkdown'> {
  readonly baseUrl: string
  private readonly catalog: Pick<ContentService, 'getDocument'>
  private readonly fetch: typeof globalThis.fetch
  private readonly development: boolean

  constructor(options: MarkdownContentProviderOptions) {
    this.development = options.development ?? false
    try {
      this.baseUrl = normalizeContentBaseUrl(options.baseUrl, this.development)
    } catch (cause) {
      if (!(cause instanceof ConfigurationError)) throw cause
      throw new ContentError('INVALID_BASE_URL', 'La raíz de contenidos no es válida.', {}, { cause })
    }
    this.catalog = options.catalog
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async getMarkdown(documentId: string): Promise<string> {
    const document = this.catalog.getDocument(documentId)
    if (!document) {
      throw new ContentError('DOCUMENT_NOT_FOUND', 'El documento no existe en el catálogo.', { documentId })
    }
    let url: string
    try {
      url = resolveSafeRelativeUrl(this.baseUrl, document.path, this.development)
    } catch (cause) {
      if (!(cause instanceof ConfigurationError)) throw cause
      throw new ContentError('UNSAFE_PATH', 'La ruta del documento no está permitida.', { documentId }, { cause })
    }

    let response: Response
    try {
      response = await this.fetch(url, { method: 'GET', credentials: 'omit', redirect: 'error' })
    } catch (cause) {
      throw new ContentError('NETWORK_ERROR', 'No se pudo descargar el documento.', { documentId, url }, { cause })
    }
    if (!response.ok) {
      throw new ContentError('HTTP_ERROR', `HTTP ${response.status} al descargar el documento.`, {
        documentId, url, status: response.status,
      })
    }
    try {
      return await response.text()
    } catch (cause) {
      throw new ContentError('NETWORK_ERROR', 'No se pudo leer el documento.', { documentId, url }, { cause })
    }
  }
}
