// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TerminalPrompt } from '../../src/terminal/TerminalPrompt'
import { Terminal } from '../../src/terminal/Terminal'
import type { TerminalEntryData } from '../../src/terminal/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('foco del prompt', () => {
  it('enfoca al montar y conserva el foco tras la ejecución', () => {
    const props = { label: 'Comando', value: '', onChange: vi.fn() }
    const { rerender } = render(<TerminalPrompt {...props} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    input.focus()
    expect(document.activeElement).toBe(input)
    expect(input.tabIndex).toBe(0)
    rerender(<TerminalPrompt {...props} pending />)
    const focus = vi.spyOn(input, 'focus')
    rerender(<TerminalPrompt {...props} pending={false} />)
    expect(document.activeElement).toBe(input)
    expect(focus).not.toHaveBeenCalled()
    expect(input.closest('div')?.className).not.toContain('focus-within:outline')
    expect(input.className).toContain('outline-none')
  })

  it.each(['enlace', 'código', 'historial', 'botón'])('respeta el foco en %s durante y después de la ejecución', async (target) => {
    const props = { label: 'Comando', value: '', onChange: vi.fn() }
    const view = (pending: boolean) => <>
      <a href="#info">Información</a>
      <pre tabIndex={0} aria-label="Código">const value = 1</pre>
      <div role="region" tabIndex={0} aria-label="Historial" />
      <button type="button">Acción</button>
      <TerminalPrompt {...props} pending={pending} />
    </>
    const { rerender } = render(view(false))
    const input = screen.getByRole('textbox')
    input.focus()
    rerender(view(true))
    const destination = target === 'enlace' ? screen.getByRole('link')
      : target === 'código' ? screen.getByLabelText('Código')
        : target === 'historial' ? screen.getByRole('region') : screen.getByRole('button')
    const focus = vi.spyOn(input, 'focus')
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    input.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    // jsdom no implementa el avance de Tab: simular su destino nativo.
    destination.focus()
    await new Promise<void>((resolve) => queueMicrotask(resolve))
    expect(document.activeElement).toBe(destination)
    rerender(view(false))
    expect(document.activeElement).toBe(destination)
    expect(focus).not.toHaveBeenCalled()
    const backwards = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    destination.dispatchEvent(backwards)
    expect(backwards.defaultPrevented).toBe(false)
    input.focus()
    expect(document.activeElement).toBe(input)
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

  it('no vuelve al inicio del documento al redimensionar mientras se lee el final', () => {
    const resizeCallbacks = new Set<() => void>()
    vi.stubGlobal('ResizeObserver', class {
      private callback: () => void
      constructor(callback: () => void) { this.callback = callback }
      observe() { resizeCallbacks.add(this.callback) }
      disconnect() { resizeCallbacks.delete(this.callback) }
    })
    const entries: TerminalEntryData[] = [{ ...entry, status: 'success', results: [{ type: 'text', text: 'Documento largo' }] }]
    const { rerender } = render(terminal(entries))
    const panel = screen.getByRole('region', { name: labels.history })
    const scrollTo = geometry(panel)
    panel.scrollTop = 700
    fireEvent.scroll(panel)
    // Cambia la geometría sin recibir otra ejecución o resultado.
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 280 })
    fireEvent(window, new Event('resize'))
    resizeCallbacks.forEach((callback) => callback())
    rerender(terminal(entries))
    expect(scrollTo).not.toHaveBeenCalled()
    expect(panel.scrollTop).toBe(700)
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
