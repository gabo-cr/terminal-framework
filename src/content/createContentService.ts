import type { ContentConfig } from '../configuration/content.schema'
import { ContentCatalog } from './ContentCatalog'
import { ContentCache } from './ContentCache'
import { MarkdownContentProvider } from './MarkdownContentProvider'
import type { MarkdownContentProviderOptions } from './MarkdownContentProvider'
import type { ContentService } from './ContentService'

export type ContentServiceOptions = Omit<MarkdownContentProviderOptions, 'catalog'>

export interface CachedContentService extends ContentService {
  clearCache(): void
}

/** Crear una vez por sesión, con la configuración ya validada. */
export function createContentService(configuration: ContentConfig, options: ContentServiceOptions): CachedContentService {
  const catalog = new ContentCatalog(configuration)
  const provider = new MarkdownContentProvider({ ...options, catalog })
  const cache = new ContentCache(provider)
  return {
    getDocument: (id) => catalog.getDocument(id),
    getCollection: (id) => catalog.getCollection(id),
    getMarkdown: (id) => cache.getMarkdown(id),
    clearCache: () => cache.clear(),
  }
}
