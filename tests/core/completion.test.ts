import { describe, expect, it, vi } from 'vitest'
import { CommandRegistry } from '../../src/core/CommandRegistry'
import { CompletionEngine } from '../../src/core/CompletionEngine'
import { suggestCommands } from '../../src/core/suggestCommands'
import { CommandExecutor } from '../../src/core/CommandExecutor'
import { ContentCatalog } from '../../src/content/ContentCatalog'
import { createCommandRuntime } from '../../src/app/createCommandRuntime'
import { siteSchema } from '../../src/configuration/site.schema'
import type { CommandsConfig } from '../../src/configuration/commands.schema'
import type { ContentConfig } from '../../src/configuration/content.schema'

const commands: CommandsConfig = { version: 1, commands: [
  { type: 'document', name: 'about', description: 'Presentación', content: 'intro', aliases: ['home'] },
  { type: 'collection', name: 'notes', description: 'Notas', collection: 'notes', aliases: ['journal'] },
  { type: 'collection', name: 'other', description: 'Otra', collection: 'other' },
] }
const content: ContentConfig = { version: 1, collections: [
  { id: 'notes', title: 'Notas', intro: 'intro', documents: ['second', 'first', 'intro'] },
  { id: 'other', title: 'Otra', intro: 'outside', documents: ['outside'] },
], documents: ['intro', 'first', 'second', 'outside'].map((id) => ({ id, title: id, description: `Descripción ${id}`, path: `docs/${id}.md`, format: 'markdown' })) }

function setup(locale: 'es' | 'en' = 'es') {
  const registry = new CommandRegistry(commands.commands)
  const catalog = new ContentCatalog(content)
  const engine = new CompletionEngine({ registry, catalog, locale })
  return { registry, catalog, engine }
}
function names(engine: CompletionEngine, input: string) {
  const result = engine.complete(input)
  return result.type === 'empty' ? [] : result.type === 'candidate' ? [result.candidate.name] : result.suggestions.map((item) => item.name)
}

describe('CompletionEngine', () => {
  it('devuelve candidato único con descripción, tipo y entrada insertable', () => {
    expect(setup().engine.complete('abo')).toEqual({ type: 'candidate', candidate: {
      name: 'about', description: 'Presentación', kind: 'command', insertValue: 'about',
    } })
  })
  it('incluye integrados y alias en orden del registro', () => {
    const { engine } = setup()
    expect(names(engine, 'h')).toEqual(['help', 'history', 'home'])
    expect(names(engine, 'help ')).toEqual(['help', 'clear', 'history', 'about', 'home', 'notes', 'journal', 'other'])
    expect(engine.complete('HO')).toEqual({ type: 'candidate', candidate: {
      name: 'home', description: 'Presentación', kind: 'alias', insertValue: 'home',
    } })
  })
  it.each(['', '   ', '\t', 'zzz', 'notes zzz', 'unknown ', 'clear ', 'history ', 'about ', 'about extra'])('no sugiere para %j', (input) => {
    expect(setup().engine.complete(input)).toEqual({ type: 'empty' })
  })
  it('help completa nombres y alias conservando comando y separadores', () => {
    const { engine } = setup('en')
    expect(engine.complete('  HeLp\tJo')).toEqual({ type: 'candidate', candidate: {
      name: 'journal', description: 'Notas', kind: 'alias', insertValue: '  HeLp\tjournal',
    } })
    expect(engine.complete('he')).toMatchObject({ candidate: { description: 'Shows available commands or help for a command.' } })
  })
  it('completa collection por alias y mayúsculas sin cambiar el token de comando', () => {
    expect(setup().engine.complete('  JoUrNaL  FI')).toEqual({ type: 'candidate', candidate: {
      name: 'first', description: 'Descripción first', kind: 'document', insertValue: '  JoUrNaL  first',
    } })
  })
  it('list primero, documentos en orden de colección, intro sin duplicar y ninguna otra colección', () => {
    const { engine } = setup()
    expect(names(engine, 'notes ')).toEqual(['list', 'second', 'first', 'intro'])
    expect(names(engine, 'notes o')).toEqual([])
    expect(names(engine, 'other ')).toEqual(['list', 'outside'])
    expect(engine.complete('notes LI')).toEqual({ type: 'candidate', candidate: { name: 'list', kind: 'list', insertValue: 'notes list' } })
  })
  it('incluye la introducción accesible aunque no esté enumerada y permite listas vacías', () => {
    const registry = new CommandRegistry(commands.commands)
    const catalog = new ContentCatalog({ ...content, collections: [{ ...content.collections[0]!, documents: [] }] })
    const engine = new CompletionEngine({ registry, catalog })
    expect(names(engine, 'notes ')).toEqual(['list', 'intro'])
  })
  it.each(['notes first extra', 'notes -l', 'notes "first"', 'notes | first', 'notes first;', 'notes first ', 'notes\nfirst'])('rechaza sintaxis no admitida: %j', (input) => {
    expect(setup().engine.complete(input)).toEqual({ type: 'empty' })
  })
  it('no descarga Markdown ni ejecuta comandos, ni guarda resultados mutables compartidos', () => {
    const { registry, catalog } = setup()
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('No HTTP') })
    try {
      const engine = new CompletionEngine({ registry, catalog })
      const result = engine.complete('notes ')
      if (result.type === 'suggestions') result.suggestions[0]!.name = 'mutated'
      expect(names(engine, 'notes ')).toEqual(['list', 'second', 'first', 'intro'])
      expect(fetch).not.toHaveBeenCalled()
    } finally { fetch.mockRestore() }
  })
})

describe('suggestCommands', () => {
  it.each([['hlep', 'help'], ['histori', 'history'], ['abotu', 'about'], ['journl', 'journal'], ['HELP', 'help']])('sugiere %s → %s', (input, candidate) => {
    expect(suggestCommands(input, setup().registry)).toContain(candidate)
  })
  it.each(['', 'x', 'zzzzzz', 'unrelated-command', 'help other'])('evita sugerencias irrelevantes: %j', (input) => {
    expect(suggestCommands(input, setup().registry)).toEqual([])
  })
  it('ordena por distancia y orden del registro, limita a tres y no duplica', () => {
    const registry = new CommandRegistry(['bat', 'cat', 'hat', 'mat'].map((name) => ({ type: 'document' as const, name, description: name, content: 'intro' })))
    expect(suggestCommands('dat', registry)).toEqual(['bat', 'cat', 'hat'])
    expect(suggestCommands('CAT', registry)).toEqual(['cat', 'bat', 'hat'])
    expect(new Set(suggestCommands('dat', registry)).size).toBe(3)
  })
})

describe('compatibilidad y composición', () => {
  it.each(['es', 'en'] as const)('enriquece solo COMMAND_NOT_FOUND sin ejecutar alternativas en %s', async (locale) => {
    const { registry, catalog } = setup(locale)
    const getMarkdown = vi.fn(async () => '# Texto')
    const executor = new CommandExecutor({ registry, content: {
      getDocument: (id) => catalog.getDocument(id), getCollection: (id) => catalog.getCollection(id), getMarkdown,
    }, locale })
    const context = { history: [] }
    const unknown = await executor.execute('hlep', context)
    expect(unknown).toEqual([{ type: 'error', code: 'COMMAND_NOT_FOUND', command: 'hlep',
      message: locale === 'es' ? 'No existe el comando: hlep.' : 'Command not found: hlep.', suggestions: ['help'],
    }])
    expect(await executor.execute('help abot', context)).toMatchObject([{ code: 'COMMAND_NOT_FOUND', suggestions: ['about'] }])
    expect(await executor.execute('zzzzzz', context)).toEqual([{ type: 'error', code: 'COMMAND_NOT_FOUND', command: 'zzzzzz',
      message: locale === 'es' ? 'No existe el comando: zzzzzz.' : 'Command not found: zzzzzz.',
    }])
    expect(await executor.execute('about extra', context)).toMatchObject([{ code: 'INVALID_ARGUMENTS' }])
    expect(await executor.execute('notes outside', context)).toMatchObject([{ code: 'DOCUMENT_NOT_IN_COLLECTION' }])
    expect(getMarkdown).not.toHaveBeenCalled()
    expect(await executor.execute('about', context)).toEqual([{ type: 'markdown', documentId: 'intro', title: 'intro', markdown: '# Texto' }])
  })
  it('compone el motor una vez con el catálogo existente sin acceso a red', () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    const runtime = createCommandRuntime({ site: siteSchema.parse({ version: 1, name: 'Ejemplo', description: 'Ejemplo' }), commands, content }, { baseUrl: 'https://example.com/', fetch })
    expect(names(runtime.completion, 'notes ')).toEqual(['list', 'second', 'first', 'intro'])
    expect(fetch).not.toHaveBeenCalled()
  })
})
