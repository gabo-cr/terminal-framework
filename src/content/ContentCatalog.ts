import type { ContentCollection, ContentConfig, ContentDocument } from '../configuration/content.schema'
import type { ContentService } from './ContentService'

/** Consultas en memoria. Requiere esquemas y referencias previamente validados. */
export class ContentCatalog implements Pick<ContentService, 'getDocument' | 'getCollection'> {
  private readonly documents = new Map<string, ContentDocument>()
  private readonly collections = new Map<string, ContentCollection>()
  private readonly members = new Map<string, Set<string>>()

  constructor(configuration: ContentConfig) {
    for (const document of configuration.documents) {
      this.documents.set(document.id, { ...document })
    }
    for (const collection of configuration.collections) {
      this.collections.set(collection.id, { ...collection, documents: [...collection.documents] })
      this.members.set(collection.id, new Set([collection.intro, ...collection.documents]))
    }
  }

  getDocument(id: string): ContentDocument | undefined {
    const document = this.documents.get(id)
    return document ? { ...document } : undefined
  }

  getCollection(id: string): ContentCollection | undefined {
    const collection = this.collections.get(id)
    return collection ? { ...collection, documents: [...collection.documents] } : undefined
  }

  getIntroduction(collectionId: string): ContentDocument | undefined {
    const collection = this.collections.get(collectionId)
    return collection ? this.getDocument(collection.intro) : undefined
  }

  listDocuments(collectionId: string): ContentDocument[] | undefined {
    const collection = this.collections.get(collectionId)
    // La existencia de cada referencia está garantizada por la inicialización.
    return collection?.documents.map((id) => this.getDocument(id)!)
  }

  isDocumentInCollection(documentId: string, collectionId: string): boolean {
    return this.members.get(collectionId)?.has(documentId) ?? false
  }
}
