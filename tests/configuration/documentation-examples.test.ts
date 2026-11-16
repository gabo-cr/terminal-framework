import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { siteSchema } from '../../src/configuration/site.schema'
import { commandsSchema } from '../../src/configuration/commands.schema'
import { contentSchema } from '../../src/configuration/content.schema'
import { validateConfiguration } from '../../src/configuration/validateConfiguration'

function examples(file: string): unknown[] {
  return [...readFileSync(file, 'utf8').matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]!))
}

describe('ejemplos JSON publicados en la documentación', () => {
  const sites = examples('docs/configuration.md')
  const commands = examples('docs/commands.md')
  const contents = examples('docs/content.md')
  it('valida los seis bloques con los esquemas reales', () => {
    expect([sites.length, commands.length, contents.length]).toEqual([2, 2, 2])
    sites.forEach((example) => siteSchema.parse(example))
    commands.forEach((example) => commandsSchema.parse(example))
    contents.forEach((example) => contentSchema.parse(example))
  })
  it('valida referencias y rutas de las combinaciones documentadas', () => {
    for (const example of sites) {
      const site = siteSchema.parse(example)
      for (const [commandIndex, contentIndex] of [[0, 1], [1, 0], [1, 1]]) {
        validateConfiguration({ site, commands: commandsSchema.parse(commands[commandIndex!]), content: contentSchema.parse(contents[contentIndex!]) }, 'http://127.0.0.1:4174/', true)
      }
    }
  })
})
