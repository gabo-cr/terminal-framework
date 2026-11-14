// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { Terminal } from '../../src/terminal/Terminal'
import { TerminalOutput } from '../../src/terminal/TerminalOutput'
import { TerminalPrompt } from '../../src/terminal/TerminalPrompt'
import type { TerminalEntryData } from '../../src/terminal/types'

const theme = { accentColor: '#96D9A5', terminalBackground: '#292C32' }
const labels = { history: 'Ejecuciones anteriores', input: 'Comando' }
// Estas muestras solo existen en pruebas, nunca en la aplicación publicada.
const entries: readonly TerminalEntryData[] = [
  { id: '1', command: 'about', status: 'success', results: [{ type: 'text', text: 'Presentación ficticia.' }, { type: 'text', text: 'Segunda línea.' }] },
  { id: '2', command: 'code list', status: 'success', results: [{ type: 'text', text: 'Un apunte de ejemplo.' }] },
]
afterEach(cleanup)

describe('composición visual de terminal', () => {
  it('presenta cabecera, bienvenida y prompt vacío sin inventar historial', () => {
    render(<Terminal welcome={'Hola\nBienvenido.'} theme={theme} labels={labels} />)
    expect(screen.getByRole('heading', { name: 'terminal' })).toBeTruthy()
    expect(screen.getByText(/Bienvenido/).textContent).toBe('Hola\nBienvenido.')
    expect(screen.queryByRole('list')).toBeNull()
    const input = screen.getByRole('textbox', { name: 'Comando' }) as HTMLInputElement
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe('')
  })

  it('compone ejecuciones ordenadas y varios resultados como texto claro', () => {
    render(<Terminal welcome="Inicio" theme={theme} labels={labels} entries={entries} />)
    const list = screen.getByRole('list', { name: labels.history })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toContain('about')
    expect(items[0]?.textContent).toContain('Segunda línea.')
    expect(items[1]?.textContent).toContain('code list')
    expect(list.className).toContain('divide-y')
  })

  it('aplica los colores recibidos sin importar configuración ni Core', () => {
    render(<Terminal welcome="Inicio" theme={{ accentColor: '#aabbcc', terminalBackground: '#112233' }} labels={labels} />)
    const panel = screen.getByRole('region', { name: 'terminal' })
    expect(panel.style.backgroundColor).toBe('rgb(17, 34, 51)')
    expect(panel.style.color).toBe('rgb(170, 187, 204)')
  })

  it('muestra valores estáticos del prompt y etiquetas traducidas por el consumidor', () => {
    render(<TerminalPrompt label="Command" value="help" />)
    expect((screen.getByRole('textbox', { name: 'Command' }) as HTMLInputElement).value).toBe('help')
  })

  it('renderiza Markdown y descarta HTML crudo de los resultados', () => {
    const { container } = render(<TerminalOutput result={{ type: 'markdown', documentId: 'test', title: 'Test', markdown: '# Título\n<script>alert(1)</script>\n**Texto**' }} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Título')
    expect(container.querySelector('strong')?.textContent).toBe('Texto')
  })
})
