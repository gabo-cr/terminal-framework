import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('Inicialización de React', () => {
  it('renderiza la página temporal sin configuración remota', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('<main')
    expect(html).toContain('terminal-framework</h1>')
    expect(html).toContain('Página temporal de verificación.')
  })
})
