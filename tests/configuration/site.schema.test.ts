import { describe, expect, it } from 'vitest'
import { siteSchema } from '../../src/configuration/site.schema'

const minimal = { version: 1, name: 'Mi sitio', description: 'Ingeniería e ideas' }

describe('site.json', () => {
  it('acepta la configuración mínima y completa todos los valores predeterminados', () => {
    expect(siteSchema.parse(minimal)).toEqual({
      ...minimal,
      locale: 'es',
      terminal: { welcome: 'Bienvenido. Escribe help para explorar el sitio.' },
      theme: { accentColor: '#96D9A5', terminalBackground: '#292C32' },
    })
  })

  it.each(['es', 'en'] as const)('genera la bienvenida en %s con terminal omitida o vacía', (locale) => {
    const expected = locale === 'es'
      ? 'Bienvenido. Escribe help para explorar el sitio.'
      : 'Welcome. Type help to explore the site.'
    for (const terminal of [undefined, {}]) {
      expect(siteSchema.parse({ ...minimal, locale, terminal }).terminal.welcome).toBe(expected)
    }
  })

  it.each(['Hola', ''])('conserva la bienvenida explícita %j', (welcome) => {
    expect(siteSchema.parse({ ...minimal, terminal: { welcome } }).terminal.welcome).toBe(welcome)
  })

  it.each([
    [{}, { accentColor: '#96D9A5', terminalBackground: '#292C32' }],
    [{ accentColor: '#aAbB09' }, { accentColor: '#aAbB09', terminalBackground: '#292C32' }],
    [{ terminalBackground: '#000000' }, { accentColor: '#96D9A5', terminalBackground: '#000000' }],
  ])('completa theme por propiedad: %j', (theme, expected) => {
    expect(siteSchema.parse({ ...minimal, theme }).theme).toEqual(expected)
  })

  it.each([
    {}, { ...minimal, version: undefined }, { ...minimal, version: 2 }, { ...minimal, version: '1' },
    { ...minimal, name: undefined }, { ...minimal, name: '' }, { ...minimal, name: '  ' },
    { ...minimal, description: undefined }, { ...minimal, description: '' },
    { ...minimal, locale: 'fr' }, { ...minimal, locale: null },
    { ...minimal, terminal: null }, { ...minimal, terminal: { welcome: 5 } },
    { ...minimal, theme: null }, { ...minimal, theme: { accentColor: '#abc' } },
    { ...minimal, theme: { accentColor: '#12345678' } },
    { ...minimal, theme: { terminalBackground: '292C32' } },
    { ...minimal, theme: { terminalBackground: '#GG0000' } },
    { ...minimal, unknown: true }, { ...minimal, terminal: { unknown: true } },
    { ...minimal, theme: { unknown: true } },
  ])('rechaza una configuración inválida: %j', (input) => {
    expect(siteSchema.safeParse(input).success).toBe(false)
  })
})
