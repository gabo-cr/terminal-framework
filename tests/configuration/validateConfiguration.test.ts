import { describe, expect, it } from 'vitest'
import type { Configuration } from '../../src/configuration/ConfigurationLoader'
import { ConfigurationError } from '../../src/configuration/ConfigurationError'
import type { ConfigurationIssue } from '../../src/configuration/ConfigurationError'
import { siteSchema } from '../../src/configuration/site.schema'
import { validateConfiguration } from '../../src/configuration/validateConfiguration'

const baseUrl = 'https://example.com/root/'

function validConfiguration(): Configuration {
  return {
    site: siteSchema.parse({ version: 1, name: 'Sitio', description: 'Ideas' }),
    commands: { version: 1, commands: [
      { type: 'document', name: 'about', description: 'Inicio', content: 'intro', aliases: ['home'] },
      { type: 'collection', name: 'essays', description: 'Ensayos', collection: 'essays', aliases: ['blog'] },
    ] },
    content: { version: 1, collections: [
      { id: 'essays', title: 'Ensayos', intro: 'intro', documents: ['essay'] },
    ], documents: [
      { id: 'intro', title: 'Inicio', path: 'docs/intro.md', format: 'markdown' },
      { id: 'essay', title: 'Ensayo', path: 'docs/essay.md', format: 'markdown' },
    ] },
  }
}

function getIssues(configuration: Configuration): readonly ConfigurationIssue[] {
  try {
    validateConfiguration(configuration, baseUrl)
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigurationError)
    if (!(error instanceof ConfigurationError)) throw error
    expect(error.code).toBe('CROSS_VALIDATION_ERROR')
    return error.details
  }
  throw new Error('La configuración debería ser inválida')
}

describe('validación cruzada', () => {
  it('acepta referencias válidas sin modificar los datos', () => {
    const config = validConfiguration()
    const original = structuredClone(config)
    expect(() => validateConfiguration(config, baseUrl)).not.toThrow()
    expect(config).toEqual(original)
  })

  it.each([
    ['nombre/nombre', 'about', undefined],
    ['nombre/alias', 'home', undefined],
    ['alias/nombre', 'other', ['about']],
    ['alias/alias', 'other', ['home']],
    ['alias propio', 'other', ['other']],
    ['alias repetido', 'other', ['duplicate', 'duplicate']],
  ] as const)('rechaza conflicto %s', (_label, name, aliases) => {
    const config = validConfiguration()
    config.commands.commands[1] = {
      type: 'collection', description: 'Ensayos', collection: 'essays', name,
      aliases: aliases ? [...aliases] : undefined,
    }
    expect(getIssues(config)).toContainEqual(expect.objectContaining({
      code: 'COMMAND_CONFLICT', file: 'commands.json', conflictingPath: expect.any(Array),
    }))
  })

  it('distingue las referencias de comando por tipo, aunque el ID exista en el otro tipo', () => {
    const config = validConfiguration()
    config.commands.commands = [
      { type: 'document', name: 'doc', description: 'D', content: 'essays' },
      { type: 'collection', name: 'col', description: 'C', collection: 'intro' },
    ]
    expect(getIssues(config)).toEqual([
      expect.objectContaining({ code: 'DOCUMENT_NOT_FOUND', path: ['commands', 0, 'content'], value: 'essays' }),
      expect.objectContaining({ code: 'COLLECTION_NOT_FOUND', path: ['commands', 1, 'collection'], value: 'intro' }),
    ])
  })

  it('exige la introducción y cada documento enumerado, incluso en colecciones sin comandos', () => {
    const config = validConfiguration()
    config.commands.commands = []
    config.content.collections[0]!.intro = 'missing-intro'
    config.content.collections[0]!.documents = ['missing-doc']
    expect(getIssues(config)).toEqual([
      expect.objectContaining({ code: 'INTRO_NOT_FOUND', path: ['collections', 0, 'intro'] }),
      expect.objectContaining({ code: 'COLLECTION_DOCUMENT_NOT_FOUND', path: ['collections', 0, 'documents', 0] }),
    ])
  })

  it('rechaza repeticiones en la lista y permite que la introducción también esté enumerada', () => {
    const config = validConfiguration()
    config.content.collections[0]!.documents = ['intro', 'essay']
    expect(() => validateConfiguration(config, baseUrl)).not.toThrow()
    config.content.collections[0]!.documents.push('essay')
    expect(getIssues(config)).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_COLLECTION_DOCUMENT', path: ['collections', 0, 'documents', 2],
      conflictingPath: ['collections', 0, 'documents', 1],
    }))
  })

  it.each(['intro', 'documents'] as const)('reserva list en %s de una colección', (field) => {
    const config = validConfiguration()
    config.content.documents.push({ id: 'list', title: 'Lista', path: 'docs/list.md', format: 'markdown' })
    if (field === 'intro') config.content.collections[0]!.intro = 'list'
    else config.content.collections[0]!.documents.push('list')
    expect(getIssues(config)).toContainEqual(expect.objectContaining({ code: 'RESERVED_COLLECTION_DOCUMENT', value: 'list' }))
  })

  it('permite un documento global list que ninguna colección expone', () => {
    const config = validConfiguration()
    config.content.documents.push({ id: 'list', title: 'Lista', path: 'docs/list.md', format: 'markdown' })
    expect(() => validateConfiguration(config, baseUrl)).not.toThrow()
  })

  it.each(['/doc.md', '../doc.md', 'docs/../doc.md', 'https://evil.test/doc.md',
    '//evil.test/doc.md', 'doc.md?q=1', 'doc.md#x', '%2e%2e/doc.md', '%252e%252e/doc.md', 'docs\\doc.md',
  ])('rechaza rutas inseguras incluso de documentos no usados: %s', (path) => {
    const config = validConfiguration()
    config.content.documents.push({ id: 'unused', title: 'Otro', path, format: 'markdown' })
    expect(getIssues(config)).toContainEqual(expect.objectContaining({
      code: 'UNSAFE_DOCUMENT_PATH', file: 'content.json', path: ['documents', 2, 'path'], value: path,
    }))
  })
})
