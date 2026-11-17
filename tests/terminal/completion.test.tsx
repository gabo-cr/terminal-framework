// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { TerminalPrompt } from '../../src/terminal/TerminalPrompt'
import { TerminalOutput } from '../../src/terminal/TerminalOutput'
import { useTerminal } from '../../src/terminal/useTerminal'
import { CompletionEngine } from '../../src/core/CompletionEngine'
import { CommandRegistry } from '../../src/core/CommandRegistry'
import { ContentCatalog } from '../../src/content/ContentCatalog'
import type { CommandLocale } from '../../src/core/commandResults'

afterEach(cleanup)
const registry = new CommandRegistry([
  { type: 'document', name: 'about', description: 'Presentación', content: 'intro', aliases: ['home'] },
  { type: 'collection', name: 'notes', description: 'Notas', collection: 'notes', aliases: ['journal'] },
])
const catalog = new ContentCatalog({ version: 1, collections: [
  { id: 'notes', title: 'Notas', intro: 'intro', documents: ['first', 'second'] },
], documents: ['intro', 'first', 'second'].map((id) => ({ id, title: id, path: `${id}.md`, format: 'markdown', description: `Texto ${id}` })) })
const completion = new CompletionEngine({ registry, catalog })
function Harness({ initial = '', pending = false, submit = vi.fn(), previous = vi.fn(), next = vi.fn() }: {
  initial?: string; pending?: boolean; submit?: (value: string) => void; previous?: () => void; next?: () => void
}) {
  const [value, setValue] = useState(initial)
  return <><TerminalPrompt label="Comando" value={value} onChange={setValue} onSubmit={() => submit(value)} completion={completion}
    pending={pending} onHistoryPrevious={previous} onHistoryNext={next} /><button>Después</button></>
}
function field() { return screen.getByRole('combobox') as HTMLInputElement }
function key(key: string, extra = {}) { return fireEvent.keyDown(field(), { key, ...extra }) }
function edit(value: string) { fireEvent.change(field(), { target: { value, selectionStart: value.length, selectionEnd: value.length } }) }

describe('autocompletado del prompt', () => {
  it.each([['abo', 'about'], ['HO', 'home'], ['journal fi', 'journal first'], ['help abo', 'help about'], ['notes li', 'notes list']])('Tab completa %s → %s sin ejecutar', (initial, expected) => {
    const submit = vi.fn()
    render(<Harness initial={initial} submit={submit} />)
    expect(key('Tab')).toBe(false)
    expect(field().value).toBe(expected)
    expect(document.activeElement).toBe(field())
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(submit).not.toHaveBeenCalled()
  })
  it('abre múltiples, selecciona primera y expone relaciones accesibles sin región live', () => {
    render(<Harness initial="h" />)
    key('Tab')
    expect(field().value).toBe('h')
    const list = screen.getByRole('listbox', { name: 'Sugerencias de comandos' })
    const options = screen.getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('help'), expect.stringContaining('history')]))
    expect(options[0]!.getAttribute('aria-selected')).toBe('true')
    expect(field().getAttribute('aria-controls')).toBe(list.id)
    expect(field().getAttribute('aria-activedescendant')).toBe(options[0]!.id)
    expect(field().getAttribute('aria-expanded')).toBe('true')
    expect(list.hasAttribute('aria-live')).toBe(false)
    expect(list.className).toContain('overflow-y-auto')
    expect(list.className).toContain('inset-x-0')
    expect(field().className).toContain('focus-visible:outline-2')
  })
  it('flechas seleccionan con vuelta y Tab inserta sin navegar historial', () => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness initial="h" previous={previous} next={next} />)
    key('Tab'); key('ArrowUp')
    expect(screen.getAllByRole('option').at(-1)!.getAttribute('aria-selected')).toBe('true')
    key('ArrowDown'); key('ArrowDown'); key('Tab')
    expect(field().value).toBe('history')
    expect(previous).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled()
  })
  it('clic y toque completan conservando foco y sin enviar', () => {
    const submit = vi.fn()
    render(<Harness initial="h" submit={submit} />)
    key('Tab')
    const option = screen.getAllByRole('option')[2]!
    expect(fireEvent.pointerDown(option, { pointerType: 'touch' })).toBe(false)
    expect(fireEvent.mouseDown(option)).toBe(false)
    fireEvent.click(option)
    expect(field().value).toBe('home')
    expect(document.activeElement).toBe(field())
    expect(submit).not.toHaveBeenCalled()
  })
  it('Enter cierra y envía exactamente lo escrito aunque seleccione otra opción', () => {
    const submit = vi.fn()
    render(<Harness initial="h" submit={submit} />)
    key('Tab'); key('ArrowDown'); key('Enter')
    expect(submit).toHaveBeenCalledWith('h')
    expect(field().value).toBe('h')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('Escape no cambia el borrador y las flechas cerradas navegan por historial', () => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness initial="h" previous={previous} next={next} />)
    key('Tab'); key('Escape')
    expect(field().value).toBe('h'); expect(screen.queryByRole('listbox')).toBeNull()
    key('ArrowUp'); key('ArrowDown')
    expect(previous).toHaveBeenCalledOnce(); expect(next).toHaveBeenCalledOnce()
  })
  it.each(['', ' ', 'zzzz', 'about '])('Tab no se intercepta sin coincidencias: %j', (initial) => {
    render(<Harness initial={initial} />)
    expect(key('Tab')).toBe(true)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it.each(['help', 'home', 'notes list', 'notes first'])('permite Tab si la única coincidencia ya está completa: %s', (initial) => {
    render(<Harness initial={initial} />)
    expect(key('Tab')).toBe(true)
    expect(field().value).toBe(initial)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it.each([false, true])('respeta Shift+flechas con lista abierta=%s', (open) => {
    const previous = vi.fn(), next = vi.fn()
    render(<Harness initial="h" previous={previous} next={next} />)
    if (open) key('Tab')
    expect(key('ArrowUp', { shiftKey: true })).toBe(true)
    expect(key('ArrowDown', { shiftKey: true })).toBe(true)
    expect(previous).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    if (open) expect(screen.getAllByRole('option')[0]!.getAttribute('aria-selected')).toBe('true')
  })
  it('recalcula al editar, incluso una sola coincidencia, y cierra cuando no hay', () => {
    render(<Harness initial="h" />)
    key('Tab'); edit('ho')
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(field().value).toBe('ho')
    edit('zzzz')
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('no completa con el cursor en medio ni con selección o Shift+Tab', () => {
    render(<Harness initial="help" />)
    field().setSelectionRange(1, 1)
    expect(key('Tab')).toBe(true); expect(field().value).toBe('help')
    field().setSelectionRange(0, 4)
    expect(key('Tab')).toBe(true)
    field().setSelectionRange(4, 4)
    expect(key('Tab', { shiftKey: true })).toBe(true)
  })
  it('cierra al mover el cursor o abandonar la entrada, sin robar foco', async () => {
    render(<Harness initial="help " />)
    key('Tab')
    field().setSelectionRange(1, 1); fireEvent.keyUp(field(), { key: 'ArrowLeft' })
    expect(screen.queryByRole('listbox')).toBeNull()
    field().setSelectionRange(5, 5); key('Tab')
    screen.getByRole('button').focus()
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(document.activeElement).toBe(screen.getByRole('button'))
  })
  it('respeta IME y no envía ni completa eventos durante composición', () => {
    const submit = vi.fn()
    render(<Harness initial="h" submit={submit} />)
    key('Tab'); fireEvent.compositionStart(field())
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(key('Tab', { isComposing: true })).toBe(true)
    key('Enter', { isComposing: true })
    expect(submit).not.toHaveBeenCalled()
    fireEvent.compositionEnd(field()); key('Tab')
    expect(screen.getByRole('listbox')).toBeTruthy()
  })
  it('descarta la lista al iniciar una ejecución y no la restaura al finalizar', () => {
    const { rerender } = render(<Harness initial="h" />)
    key('Tab'); rerender(<Harness initial="h" pending />)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(field().readOnly).toBe(true)
    expect(key('Tab')).toBe(true)
    rerender(<Harness initial="h" pending={false} />)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('conserva historial y borrador reales después de completar una instrucción recuperada', async () => {
    function Session() {
      const terminal = useTerminal({ execute: async () => [] }, 'es')
      return <TerminalPrompt label="Comando" value={terminal.input} onChange={terminal.setInput} onSubmit={() => { void terminal.submit() }}
        pending={terminal.pending} completion={completion} onHistoryPrevious={() => terminal.navigateHistory('previous')} onHistoryNext={() => terminal.navigateHistory('next')} />
    }
    render(<Session />)
    edit('about'); key('Enter')
    await waitFor(() => expect(field().getAttribute('aria-busy')).toBe('false'))
    edit('mi borrador'); key('ArrowUp')
    expect(field().value).toBe('about')
    edit('h'); key('Tab'); key('Tab')
    expect(field().value).toBe('help')
    key('ArrowDown')
    expect(field().value).toBe('mi borrador')
    key('ArrowUp')
    expect(field().value).toBe('about')
  })
})

describe('alternativas de error', () => {
  it.each(['es', 'en'] as const)('presenta hasta tres alternativas discretas en %s', (locale: CommandLocale) => {
    render(<TerminalOutput locale={locale} result={{ type: 'error', code: 'COMMAND_NOT_FOUND', command: 'x', message: 'Error original', suggestions: ['help', 'history', 'home', 'about'] }} />)
    expect(screen.getByRole('alert').textContent).toBe('Error original')
    expect(screen.getByText(locale === 'es' ? /Quizá quisiste decir/ : /Did you mean/)).toBeTruthy()
    expect(screen.queryByText('about')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('help').tagName).toBe('CODE')
  })
})
