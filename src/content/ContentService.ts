import type { ContentCollection, ContentDocument } from '../configuration/content.schema'

// Consultas al catálogo validado; solo el cuerpo Markdown requiere carga asíncrona.
export interface ContentService {
  getDocument(id: string): ContentDocument | undefined
  getCollection(id: string): ContentCollection | undefined
  getMarkdown(documentId: string): Promise<string>
}
