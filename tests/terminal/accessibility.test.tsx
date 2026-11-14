// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TerminalPrompt } from '../../src/terminal/TerminalPrompt'
import { Terminal } from '../../src/terminal/Terminal'
import type { TerminalEntryData } from '../../src/terminal/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('foco del prompt', () => {
  it('no roba el foco al montar y lo conserva tras la ejecución sin desplazar la página', () => {
    const props = { label: 'Comando', value: '', onChange: vi.fn() }
    const { rerender } = render(<TerminalPrompt {...props} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(document.activeElement).not.toBe(input)
    input.focus()
    expect(document.activeElement).toBe(input)
    expect(input.tabIndex).toBe(0)
    rerender(<TerminalPrompt {...props} pending />)
    const focus = vi.spyOn(input, 'focus')
    rerender(<TerminalPrompt {...props} pending={false} />)
    expect(document.activeElement).toBe(input)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(input.closest('div')?.className).toContain('focus-within:outline')
  })

  it('no recupera foco si el visitante pasa a un enlace durante la espera', () => {
    const props = { label: 'Comando', value: '', onChange: vi.fn() }
    const view = (pending: boolean) => <><a href="#info">Información</a><TerminalPrompt {...props} pending={pending} /></>
    const { rerender } = render(view(false))
    const input = screen.getByRole('textbox')
    input.focus()
    rerender(view(true))
    const link = screen.getByRole('link')
    link.focus()
    const focus = vi.spyOn(input, 'focus')
    rerender(view(false))
    expect(document.activeElement).toBe(link)
    expect(focus).not.toHaveBeenCalled()
  })

  it('ignora composición IME y no intercepta flechas modificadas', () => {
    const previous = vi.fn()
    const submit = vi.fn()
    render(<TerminalPrompt label="Comando" onChange={() => {}} onSubmit={submit} onHistoryPrevious={previous} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    fireEvent.keyDown(input, { key: 'ArrowUp', isComposing: true })
    fireEvent.keyDown(input, { key: 'ArrowUp', ctrlKey: true })
    expect(submit).not.toHaveBeenCalled()
    expect(previous).not.toHaveBeenCalled()
  })
})

const labels = { input: 'Comando', history: 'Salida de terminal', pending: 'Ejecutando…' }
const theme = { accentColor: '#96D9A5', terminalBackground: '#292C32' }
const entry: TerminalEntryData = { id: 'one', command: 'about', status: 'pending', results: [] }
function terminal(entries: readonly TerminalEntryData[]) {
  return <Terminal theme={theme} labels={labels} welcome="Bienvenida" entries={entries} />
}

describe('desplazamiento local y anuncios', () => {
  function geometry(panel: HTMLElement) {
    Object.defineProperties(panel, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 300 },
    })
    const scrollTo = vi.fn()
    Object.defineProperty(panel, 'scrollTo', { value: scrollTo })
    return scrollTo
  }

  it.each([true, false])('sigue el resultado reciente y respeta movimiento reducido: %s', (reduced) => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })))
    const { rerender } = render(terminal([entry]))
    const panel = screen.getByRole('region', { name: labels.history })
    const scrollTo = geometry(panel)
    Object.defineProperty(panel.querySelector('[data-terminal-entry]'), 'offsetTop', { value: 150 })
    panel.scrollTop = 680
    fireEvent.scroll(panel)
    rerender(terminal([{ ...entry, status: 'success', results: [{ type: 'text', text: 'Documento largo' }] }]))
    expect(scrollTo).toHaveBeenCalledWith({ top: 150, behavior: reduced ? 'auto' : 'smooth' })
    expect(panel.className).toContain('overflow-y-auto')
    expect(panel.tabIndex).toBe(0)
    expect(panel.getAttribute('aria-live')).toBeNull()
  })

  it('no fuerza scroll mientras el visitante lee una ejecución anterior', () => {
    const { rerender } = render(terminal([entry]))
    const panel = screen.getByRole('region', { name: labels.history })
    const scrollTo = geometry(panel)
    panel.scrollTop = 100
    fireEvent.scroll(panel)
    rerender(terminal([{ ...entry, status: 'success', results: [{ type: 'text', text: 'Resultado' }] }]))
    expect(scrollTo).not.toHaveBeenCalled()
    panel.scrollTop = 700
    fireEvent.scroll(panel)
    rerender(terminal([{ ...entry, status: 'success', results: [{ type: 'text', text: 'Nuevo resultado' }] }]))
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('anuncia solo el indicador de ejecución y conserva la bienvenida al limpiar', () => {
    const { rerender } = render(terminal([entry]))
    expect(screen.getByRole('status').textContent).toBe('Ejecutando…')
    const panel = screen.getByRole('region', { name: labels.history })
    expect(screen.getByRole('list').getAttribute('aria-live')).toBeNull()
    panel.scrollTop = 200
    rerender(terminal([]))
    expect(panel.scrollTop).toBe(0)
    expect(screen.getByText('Bienvenida')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
