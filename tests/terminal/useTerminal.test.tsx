// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTerminal } from '../../src/terminal/useTerminal'
import { Terminal } from '../../src/terminal/Terminal'
import { CommandExecutor } from '../../src/core/CommandExecutor'
import { CommandRegistry } from '../../src/core/CommandRegistry'
import type { CommandResult } from '../../src/core/commandResults'

afterEach(cleanup)
function executor() {
  return new CommandExecutor({ registry: new CommandRegistry(), locale: 'es', content: {
    getDocument: () => undefined, getCollection: () => undefined, getMarkdown: async () => '',
  } })
}
function Harness({ executor = executorInstance }: { executor?: Pick<CommandExecutor, 'execute'> }) {
  const terminal = useTerminal(executor, 'es')
  return <Terminal welcome="Bienvenida permanente" theme={{ accentColor: '#96D9A5', terminalBackground: '#292C32' }}
    labels={{ input: 'Comando', history: 'Historial visual', pending: 'Ejecutando…' }}
    entries={terminal.entries} promptValue={terminal.input} pending={terminal.pending}
    onHistoryPrevious={() => terminal.navigateHistory('previous')} onHistoryNext={() => terminal.navigateHistory('next')}
    onInputChange={terminal.setInput} onSubmit={() => { void terminal.submit() }} />
}
const executorInstance = executor()

describe('useTerminal', () => {
  it('ignora entradas vacías sin registrar ni llamar al ejecutor', async () => {
    const execute = vi.fn(async () => [])
    const { result } = renderHook(() => useTerminal({ execute }, 'es'))
    act(() => result.current.setInput(' \t '))
    await act(async () => { await result.current.submit() })
    expect(execute).not.toHaveBeenCalled()
    expect(result.current.entries).toEqual([])
    expect(result.current.commandHistory).toEqual([])
  })

  it('conserva texto original, contexto previo, estado pending y bloquea envíos simultáneos', async () => {
    let finish!: (results: CommandResult[]) => void
    const execute = vi.fn(() => new Promise<CommandResult[]>((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useTerminal({ execute }, 'es'))
    act(() => result.current.setInput('  help  '))
    let pending!: Promise<void>
    act(() => { pending = result.current.submit(); void result.current.submit() })
    expect(execute).toHaveBeenCalledExactlyOnceWith('  help  ', { history: [] })
    expect(result.current.input).toBe('')
    expect(result.current.pending).toBe(true)
    expect(result.current.entries[0]).toMatchObject({ command: '  help  ', status: 'pending', results: [] })
    expect(result.current.commandHistory).toEqual(['  help  '])
    await act(async () => { finish([{ type: 'text', text: 'OK' }]); await pending })
    expect(result.current.entries[0]?.status).toBe('success')
    expect(result.current.pending).toBe(false)
  })

  it('registra errores recuperables y permite una ejecución posterior', async () => {
    const execute = vi.fn<CommandExecutor['execute']>()
      .mockResolvedValueOnce([{ type: 'error', code: 'COMMAND_NOT_FOUND', command: 'bad', message: 'No existe' }])
      .mockResolvedValueOnce([{ type: 'text', text: 'Recuperado' }])
    const { result } = renderHook(() => useTerminal({ execute }, 'es'))
    act(() => result.current.setInput('bad'))
    await act(async () => { await result.current.submit() })
    expect(result.current.entries[0]?.status).toBe('error')
    act(() => result.current.setInput('help'))
    await act(async () => { await result.current.submit() })
    expect(execute).toHaveBeenLastCalledWith('help', { history: ['bad'] })
    expect(result.current.entries.map(({ status }) => status)).toEqual(['error', 'success'])
  })

  it.each(['es', 'en'] as const)('captura un rechazo inesperado con mensaje en %s y desbloquea', async (locale) => {
    const execute = vi.fn<CommandExecutor['execute']>().mockRejectedValue(new Error('unexpected'))
    const { result } = renderHook(() => useTerminal({ execute }, locale))
    act(() => result.current.setInput('help'))
    await act(async () => { await result.current.submit() })
    expect(result.current.pending).toBe(false)
    expect(result.current.entries[0]).toMatchObject({ status: 'error', results: [{ type: 'error',
      message: locale === 'es' ? 'No se pudo ejecutar la instrucción. Inténtalo de nuevo.' : 'Could not execute the instruction. Please try again.' }] })
  })

  it('muestra ejecución pendiente y evita Enter duplicado mientras espera', async () => {
    let finish!: (results: CommandResult[]) => void
    const execute = vi.fn(() => new Promise<CommandResult[]>((resolve) => { finish = resolve }))
    render(<Harness executor={{ execute }} />)
    const input = screen.getByRole('textbox', { name: 'Comando' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'help' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter', repeat: true })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('status').textContent).toBe('Ejecutando…')
    expect(input.readOnly).toBe(true)
    expect(input.value).toBe('')
    expect(execute).toHaveBeenCalledTimes(1)
    await act(async () => { finish([{ type: 'text', text: 'Listo' }]) })
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Listo')).toBeTruthy()
    expect(input.readOnly).toBe(false)
    expect(within(screen.getByRole('list', { name: 'Historial visual' })).getAllByRole('listitem')).toHaveLength(1)
  })

  it('navega con flechas, conserva alias y espacios y recupera el borrador', async () => {
    const execute = vi.fn<CommandExecutor['execute']>().mockResolvedValue([])
    const { result } = renderHook(() => useTerminal({ execute }, 'es'))
    for (const input of ['  acerca  ', 'code list']) {
      act(() => result.current.setInput(input))
      await act(async () => { await result.current.submit() })
    }
    const original = [...result.current.commandHistory]
    act(() => result.current.setInput('borrador sin enviar'))
    act(() => result.current.navigateHistory('previous'))
    expect(result.current.input).toBe('code list')
    act(() => { result.current.navigateHistory('previous'); result.current.navigateHistory('previous') })
    expect(result.current.input).toBe('  acerca  ')
    act(() => result.current.setInput('edición de la copia'))
    act(() => result.current.navigateHistory('next'))
    expect(result.current.input).toBe('code list')
    act(() => { result.current.navigateHistory('next'); result.current.navigateHistory('next') })
    expect(result.current.input).toBe('borrador sin enviar')
    expect(result.current.commandHistory).toEqual(original)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('las flechas sin historial no alteran el borrador ni ejecutan comandos', () => {
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Comando' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'borrador' } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('borrador')
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('conecta la navegación de teclado después de ejecutar sin mutar el historial', async () => {
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Comando' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '  help  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.readOnly).toBe(false))
    fireEvent.change(input, { target: { value: 'mi borrador' } })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input.value).toBe('  help  ')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.value).toBe('mi borrador')
  })

  it('ejecuta al pulsar Enter, muestra errores y clear conserva bienvenida e historial original', async () => {
    render(<Harness />)
    const input = screen.getByRole('textbox', { name: 'Comando' }) as HTMLInputElement
    const enter = async (value: string) => {
      fireEvent.change(input, { target: { value } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await waitFor(() => expect(input.readOnly).toBe(false))
    }
    await enter('missing')
    expect(screen.getByRole('alert').textContent).toContain('No existe el comando: missing.')
    await enter('  help  ')
    expect(screen.getByRole('list', { name: 'Historial visual' }).textContent).toContain('Comandos disponibles')
    await enter('clear')
    expect(screen.queryByRole('list', { name: 'Historial visual' })).toBeNull()
    expect(screen.getByText('Bienvenida permanente')).toBeTruthy()
    expect(input.value).toBe('')
    await enter('history')
    const visual = screen.getByRole('list', { name: 'Historial visual' })
    const entry = within(visual).getAllByRole('listitem')[0]!
    expect(entry.textContent).toContain('1. missing')
    expect(entry.textContent).toContain('2.   help  ')
    expect(entry.textContent).toContain('3. clear')
    expect(entry.textContent).toContain('4. history')
    expect(entry.getAttribute('data-status')).toBe('success')
  })
})
