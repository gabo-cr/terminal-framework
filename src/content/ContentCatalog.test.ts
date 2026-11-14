import { describe, expect, it, vi } from 'vitest'
import type { ContentConfig } from '../configuration/content.schema'
import type { ContentService } from './ContentService'
import { CommandExecutor } from '../core/CommandExecutor'
import { CommandRegistry } from '../core/CommandRegistry'
import { ContentCatalog } from './ContentCatalog'

function fixture(): ContentConfig {
  return {
    version: 1,
    documents: ['intro', 'first', 'second', 'shared', 'standalone'].map((id) => ({
      id, title: `Título ${id}`, description: `Descripción ${id}`, path: `docs/${id}.md`, format: 'markdown',
    })),
    collections: [
      { id: 'notes', title: 'Notas', intro: 'intro', documents: ['second', 'shared', 'first'] },
      { id: 'essays', title: 'Ensayos', intro: 'intro', documents: ['shared'] },
      { id: 'empty', title: 'Vacía', intro: 'intro', documents: [] },
    ],
  }
}

describe('ContentCatalog', () => {
  it('obtiene documentos globales y colecciones con los tipos y metadatos originales', () => {
    const configuration = fixture()
    const catalog = new ContentCatalog(configuration)
    expect(catalog.getDocument('first')).toEqual(configuration.documents[1])
    expect(catalog.getCollection('notes')).toEqual(configuration.collections[0])
  })

  it.each(['missing', '', 'FIRST', ' first ', '__proto__', 'constructor'])('gestiona IDs inexistentes exactamente: %j', (id) => {
    const catalog = new ContentCatalog(fixture())
    expect(catalog.getDocument(id)).toBeUndefined()
    expect(catalog.getCollection(id)).toBeUndefined()
    expect(catalog.getIntroduction(id)).toBeUndefined()
    expect(catalog.listDocuments(id)).toBeUndefined()
    expect(catalog.isDocumentInCollection(id, 'notes')).toBe(false)
    expect(catalog.isDocumentInCollection('first', id)).toBe(false)
  })

  it('resuelve la introducción sin incluirla automáticamente en el listado', () => {
    const catalog = new ContentCatalog(fixture())
    expect(catalog.getIntroduction('notes')).toEqual(catalog.getDocument('intro'))
    expect(catalog.listDocuments('notes')?.map(({ id }) => id)).toEqual(['second', 'shared', 'first'])
    expect(catalog.isDocumentInCollection('intro', 'notes')).toBe(true)
  })

  it('respeta la posición configurada de la introducción cuando también está enumerada', () => {
    const config = fixture()
    config.collections[0]!.documents = ['second', 'intro', 'first']
    const catalog = new ContentCatalog(config)
    expect(catalog.listDocuments('notes')?.map(({ id }) => id)).toEqual(['second', 'intro', 'first'])
  })

  it('admite documentos compartidos y documentos sin colección', () => {
    const catalog = new ContentCatalog(fixture())
    expect(catalog.isDocumentInCollection('shared', 'notes')).toBe(true)
    expect(catalog.isDocumentInCollection('shared', 'essays')).toBe(true)
    expect(catalog.listDocuments('essays')).toEqual([catalog.getDocument('shared')])
    expect(catalog.getDocument('standalone')).toBeDefined()
    for (const collection of ['notes', 'essays', 'empty']) {
      expect(catalog.isDocumentInCollection('standalone', collection)).toBe(false)
    }
    expect(catalog.isDocumentInCollection('first', 'essays')).toBe(false)
  })

  it('admite colecciones vacías con introducción y las distingue de las inexistentes', () => {
    const catalog = new ContentCatalog(fixture())
    expect(catalog.listDocuments('empty')).toEqual([])
    expect(catalog.getIntroduction('empty')?.id).toBe('intro')
    expect(catalog.isDocumentInCollection('intro', 'empty')).toBe(true)
    expect(catalog.isDocumentInCollection('first', 'empty')).toBe(false)
    expect(catalog.listDocuments('missing')).toBeUndefined()
  })

  it('admite un catálogo completamente vacío', () => {
    const catalog = new ContentCatalog({ version: 1, documents: [], collections: [] })
    expect(catalog.getDocument('intro')).toBeUndefined()
    expect(catalog.listDocuments('notes')).toBeUndefined()
    expect(catalog.isDocumentInCollection('intro', 'notes')).toBe(false)
  })

  it('mantiene índices independientes para IDs iguales en documentos y colecciones', () => {
    const configuration = fixture()
    configuration.collections[0]!.id = 'first'
    const catalog = new ContentCatalog(configuration)
    expect(catalog.getDocument('first')?.title).toBe('Título first')
    expect(catalog.getCollection('first')?.title).toBe('Notas')
  })

  it('protege sus índices y orden frente a mutaciones de entrada y de resultados', () => {
    const configuration = fixture()
    const catalog = new ContentCatalog(configuration)
    configuration.documents[1]!.id = 'changed'
    configuration.collections[0]!.documents.reverse()
    catalog.getDocument('first')!.title = 'Changed'
    catalog.getCollection('notes')!.documents.push('standalone')
    const listed = catalog.listDocuments('notes')!
    listed[0]!.id = 'changed'
    listed.reverse()
    expect(catalog.getDocument('first')?.title).toBe('Título first')
    expect(catalog.getDocument('changed')).toBeUndefined()
    expect(catalog.listDocuments('notes')?.map(({ id }) => id)).toEqual(['second', 'shared', 'first'])
    expect(catalog.isDocumentInCollection('standalone', 'notes')).toBe(false)
  })

  it('mantiene compatibilidad con ContentService y el ejecutor sin implementar carga Markdown', async () => {
    const catalog = new ContentCatalog(fixture())
    const getMarkdown = vi.fn(async (id: string) => `# ${id}`)
    const service: ContentService = {
      getDocument: (id) => catalog.getDocument(id),
      getCollection: (id) => catalog.getCollection(id),
      getMarkdown,
    }
    const executor = new CommandExecutor({
      registry: new CommandRegistry([{ type: 'collection', name: 'notes', description: 'Notas', collection: 'notes' }]),
      content: service, locale: 'es',
    })
    const results = await executor.execute('notes list', { history: [] })
    expect(results).toMatchObject([{ type: 'list', items: [{ id: 'second' }, { id: 'shared' }, { id: 'first' }] }])
    expect(getMarkdown).not.toHaveBeenCalled()
    expect(await executor.execute('notes intro', { history: [] })).toMatchObject([{ type: 'markdown', documentId: 'intro' }])
  })
})
