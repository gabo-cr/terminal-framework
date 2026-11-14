import type { ContentService } from './ContentService'

/** Una instancia por sesión y proveedor asociado a una única raíz y catálogo. */
export class ContentCache implements Pick<ContentService, 'getMarkdown'> {
  private readonly provider: Pick<ContentService, 'getMarkdown'>
  private readonly entries = new Map<string, Promise<string>>()

  constructor(provider: Pick<ContentService, 'getMarkdown'>) {
    this.provider = provider
  }

  // No async: todas las consultas del mismo ID reciben la misma Promise.
  getMarkdown(documentId: string): Promise<string> {
    const cached = this.entries.get(documentId)
    if (cached) return cached

    const pending = Promise.resolve().then(() => this.provider.getMarkdown(documentId)).catch((error: unknown) => {
      // Un fallo anterior a clear() no debe eliminar una solicitud nueva.
      if (this.entries.get(documentId) === pending) this.entries.delete(documentId)
      throw error
    })
    this.entries.set(documentId, pending)
    return pending
  }

  clear(): void {
    this.entries.clear()
  }
}
