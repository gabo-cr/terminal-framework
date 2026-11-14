import { describe, expect, it } from 'vitest'
import { collectionSchema, contentSchema, documentSchema } from '../../src/configuration/content.schema'

const document = { id: 'intro', title: 'Introducción', path: 'docs/intro.md', format: 'markdown' }
const collection = { id: 'essays', title: 'Ensayos', intro: 'intro', documents: ['second', 'first'] }
const minimal = { version: 1, collections: [], documents: [] }

describe('content.json', () => {
  it('acepta un catálogo mínimo con arreglos vacíos obligatorios', () => {
    expect(contentSchema.parse(minimal)).toEqual(minimal)
  })

  it('conserva el orden y acepta referencias aún no resueltas y descripciones opcionales', () => {
    const input = {
      version: 1,
      collections: [{ ...collection, description: 'Ideas' }],
      documents: [{ ...document, description: 'Inicio' }],
    }
    expect(contentSchema.parse(input)).toEqual(input)
  })

  it('permite el mismo ID entre tipos distintos', () => {
    expect(contentSchema.safeParse({
      version: 1, collections: [{ ...collection, id: document.id }], documents: [document],
    }).success).toBe(true)
  })

  it.each(['documents', 'collections'] as const)('rechaza IDs repetidos en %s con ruta del error', (kind) => {
    const item = kind === 'documents' ? document : collection
    const result = contentSchema.safeParse({ ...minimal, [kind]: [item, item] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [kind, 1, 'id'] }))
    }
  })

  it('rechaza documentos repetidos dentro de una colección con ruta del error', () => {
    const result = contentSchema.safeParse({
      ...minimal, collections: [{ ...collection, documents: ['first', 'second', 'first'] }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['collections', 0, 'documents', 2] }))
    }
  })

  it.each(['a', 'intro-2', '2026-notes'])('acepta kebab-case sencillo: %s', (id) => {
    expect(documentSchema.safeParse({ ...document, id }).success).toBe(true)
  })

  it.each(['', 'My-id', 'my_id', '-intro', 'intro-', 'two--words', 'with spaces', 'ámbito'])('rechaza ID inválido: %j', (id) => {
    expect(documentSchema.safeParse({ ...document, id }).success).toBe(false)
    expect(collectionSchema.safeParse({ ...collection, id }).success).toBe(false)
    expect(collectionSchema.safeParse({ ...collection, intro: id }).success).toBe(false)
    expect(collectionSchema.safeParse({ ...collection, documents: [id] }).success).toBe(false)
  })

  it.each([
    {}, { ...minimal, version: undefined }, { ...minimal, version: 2 }, { ...minimal, version: '1' },
    { ...minimal, documents: undefined }, { ...minimal, collections: undefined },
    { ...minimal, documents: null }, { ...minimal, collections: {} }, { ...minimal, extra: true },
    { ...minimal, documents: [{ ...document, extra: true }] },
    { ...minimal, collections: [{ ...collection, extra: true }] },
    { ...minimal, documents: [{ ...document, title: '' }] },
    { ...minimal, documents: [{ ...document, path: '' }] },
    { ...minimal, documents: [{ ...document, path: undefined }] },
    { ...minimal, documents: [{ ...document, format: 'html' }] },
    { ...minimal, documents: [{ ...document, format: undefined }] },
    { ...minimal, collections: [{ ...collection, intro: undefined }] },
    { ...minimal, collections: [{ ...collection, documents: undefined }] },
    { ...minimal, collections: [{ ...collection, title: ' ' }] },
    { ...minimal, documents: [{ ...document, description: 3 }] },
  ])('rechaza estructuras inválidas: %j', (input) => {
    expect(contentSchema.safeParse(input).success).toBe(false)
  })
})
