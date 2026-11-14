import type { Configuration } from './ConfigurationLoader'
import { ConfigurationError } from './ConfigurationError'
import type { ConfigurationIssue } from './ConfigurationError'
import { normalizeContentBaseUrl, resolveSafeRelativeUrl } from './urls'

// Recibe datos que ya pasaron los esquemas. No muta ni descarga contenidos.
export function validateConfiguration(
  configuration: Configuration,
  baseUrl: string,
  development = false,
): void {
  const root = normalizeContentBaseUrl(baseUrl, development)
  const issues: ConfigurationIssue[] = []
  const documents = new Set(configuration.content.documents.map(({ id }) => id))
  const collections = new Set(configuration.content.collections.map(({ id }) => id))
  const names = new Map<string, (string | number)[]>()

  configuration.commands.commands.forEach((command, index) => {
    const tokens = [
      { value: command.name, path: ['commands', index, 'name'] },
      ...(command.aliases ?? []).map((value, aliasIndex) => ({
        value, path: ['commands', index, 'aliases', aliasIndex],
      })),
    ]
    for (const { value, path } of tokens) {
      const conflictingPath = names.get(value)
      if (conflictingPath) {
        issues.push({
          code: 'COMMAND_CONFLICT', file: 'commands.json', path, value, conflictingPath,
          message: `Nombre o alias repetido: ${value}`,
        })
      } else {
        names.set(value, path)
      }
    }
    const isDocument = command.type === 'document'
    const value = isDocument ? command.content : command.collection
    if (!(isDocument ? documents : collections).has(value)) {
      issues.push({
        code: isDocument ? 'DOCUMENT_NOT_FOUND' : 'COLLECTION_NOT_FOUND',
        file: 'commands.json', path: ['commands', index, isDocument ? 'content' : 'collection'], value,
        message: `Referencia de comando inexistente: ${value}`,
      })
    }
  })

  configuration.content.collections.forEach((collection, index) => {
    const path = ['collections', index]
    if (!documents.has(collection.intro)) {
      issues.push({
        code: 'INTRO_NOT_FOUND', file: 'content.json', path: [...path, 'intro'], value: collection.intro,
        message: `Documento introductorio inexistente: ${collection.intro}`,
      })
    }
    const seen = new Map<string, number>()
    collection.documents.forEach((id, documentIndex) => {
      const documentPath = [...path, 'documents', documentIndex]
      if (!documents.has(id)) {
        issues.push({
          code: 'COLLECTION_DOCUMENT_NOT_FOUND', file: 'content.json', path: documentPath, value: id,
          message: `Documento de colección inexistente: ${id}`,
        })
      }
      const previousIndex = seen.get(id)
      if (previousIndex !== undefined) {
        issues.push({
          code: 'DUPLICATE_COLLECTION_DOCUMENT', file: 'content.json', path: documentPath, value: id,
          conflictingPath: [...path, 'documents', previousIndex],
          message: `Documento repetido en la colección: ${id}`,
        })
      } else {
        seen.set(id, documentIndex)
      }
    })
    // La introducción también es un documento accesible de la colección.
    if (collection.intro === 'list' || seen.has('list')) {
      issues.push({
        code: 'RESERVED_COLLECTION_DOCUMENT', file: 'content.json', value: 'list',
        path: collection.intro === 'list' ? [...path, 'intro'] : [...path, 'documents', seen.get('list')!],
        message: 'El ID list está reservado para listar los documentos de una colección.',
      })
    }
  })

  configuration.content.documents.forEach((document, index) => {
    try {
      resolveSafeRelativeUrl(root, document.path, development)
    } catch (error) {
      if (!(error instanceof ConfigurationError) || error.kind !== 'unsafe-path') throw error
      issues.push({
        code: 'UNSAFE_DOCUMENT_PATH', file: 'content.json', path: ['documents', index, 'path'],
        value: document.path, message: `Ruta de documento no permitida: ${document.path}`,
      })
    }
  })

  if (issues.length) {
    throw new ConfigurationError(
      'cross-validation', `La configuración contiene ${issues.length} errores de coherencia.`,
      undefined, undefined, { details: issues },
    )
  }
}
