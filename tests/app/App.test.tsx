// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import siteJson from '../fixtures/ui-site/config/site.json?raw'
import commandsJson from '../fixtures/ui-site/config/commands.json?raw'
import contentJson from '../fixtures/ui-site/config/content.json?raw'

const exampleName: string = JSON.parse(siteJson).name
const examples: Record<string, string> = { 'site.json': siteJson, 'commands.json': commandsJson, 'content.json': contentJson }
import { App } from '../../src/app/App'
import { bootstrapApplication } from '../../src/app/bootstrapApplication'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

function exampleFetch(invalid = false) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const filename = new URL(String(input)).pathname.split('/').at(-1)
    const data = JSON.parse(examples[filename!]!)
    if (invalid && filename === 'site.json') data.version = 99
    return Response.json(data)
  })
}

function exampleLoader(fetch = exampleFetch()) {
  return () => bootstrapApplication({ baseUrl: 'http://localhost:5173/example-content', development: true, fetch })
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Interfaz de arranque', () => {
  it('muestra un indicador discreto durante la carga', () => {
    render(<App load={() => new Promise(() => {})} />)
    expect(screen.getByRole('status').textContent).toBe('Cargando…')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('presenta los datos, colores y metadatos de una configuración válida', async () => {
    render(<App load={exampleLoader()} />)
    expect(await screen.findByRole('heading', { level: 1, name: exampleName })).toBeTruthy()
    expect(screen.getByText(/Un espacio ficticio/)).toBeTruthy()
    const panel = screen.getByRole('region', { name: 'terminal' })
    expect(panel.style.backgroundColor).toBe('rgb(41, 44, 50)')
    expect(panel.style.color).toBe('rgb(150, 217, 165)')
    expect(panel.textContent).toContain('Bienvenido al cuaderno.')
    await waitFor(() => expect(document.title).toBe(exampleName))
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('Un espacio ficticio')
    expect(document.documentElement.lang).toBe('es')
    expect(screen.getByRole('textbox', { name: 'Comando' }).hasAttribute('readonly')).toBe(false)
  })

  it('muestra error ante una configuración inválida y reintenta desde el bootstrap', async () => {
    const fetch = exampleFetch(true)
    const load = exampleLoader(fetch)
    render(<App load={load} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText(exampleName)).toBeNull()
    fetch.mockImplementation(exampleFetch())
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByRole('heading', { name: exampleName })).toBeTruthy()
    expect(fetch).toHaveBeenCalledTimes(6)
  })

  it('usa el idioma inicial para errores y carga antes de conocer site.locale', async () => {
    render(<App initialLocale="en" load={async () => { throw new Error('offline') }} />)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('aplica idioma y bienvenida predeterminada ingleses, y colores personalizados', async () => {
    const fetch = exampleFetch()
    fetch.mockImplementation(async (input) => {
      const filename = new URL(String(input)).pathname.split('/').at(-1)
      if (filename !== 'site.json') return exampleFetch()(input)
      return Response.json({ version: 1, name: 'Notebook', description: 'Notes', locale: 'en', theme: { accentColor: '#aabbcc', terminalBackground: '#112233' } })
    })
    render(<App load={exampleLoader(fetch)} />)
    const panel = await screen.findByRole('region', { name: 'terminal' })
    expect(screen.getByText('Welcome. Type help to explore the site.')).toBeTruthy()
    expect(panel.style.backgroundColor).toBe('rgb(17, 34, 51)')
    expect(panel.style.color).toBe('rgb(170, 187, 204)')
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
  })

  it('tolera StrictMode e ignora resultados de efectos que ya no están activos', async () => {
    const fetch = exampleFetch()
    const load = vi.fn(exampleLoader(fetch))
    render(<StrictMode><App load={load} /></StrictMode>)
    await waitFor(() => expect(screen.getByRole('heading', { name: exampleName })).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each(['resolve', 'reject'] as const)('descarta un arranque obsoleto que termina con %s', async (outcome) => {
    const previous = deferred<Awaited<ReturnType<typeof bootstrapApplication>>>()
    const oldLoad = vi.fn(() => previous.promise)
    const { rerender } = render(<App load={oldLoad} />)
    await waitFor(() => expect(oldLoad).toHaveBeenCalledTimes(1))
    rerender(<App load={exampleLoader()} />)
    await screen.findByRole('textbox', { name: 'Comando' })
    await act(async () => {
      if (outcome === 'reject') previous.reject(new Error('Obsolete failure'))
      else {
        const old = await exampleLoader()()
        old.configuration.site.name = 'Obsolete site'
        previous.resolve(old)
      }
    })
    expect(screen.getByRole('heading', { name: exampleName })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Obsolete site')).toBeNull()
  })

  it('retira la sesión previa y descarta comandos pendientes al cambiar el cargador', async () => {
    const oldApplication = await exampleLoader()()
    const command = deferred<Awaited<ReturnType<typeof oldApplication.executor.execute>>>()
    vi.spyOn(oldApplication.executor, 'execute').mockReturnValue(command.promise)
    const oldLoad = vi.fn(async () => oldApplication)
    const next = deferred<typeof oldApplication>()
    const newLoad = vi.fn(() => next.promise)
    const { rerender } = render(<App load={oldLoad} />)
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: 'about' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    rerender(<App load={newLoad} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Cargando…')
    await act(async () => { next.resolve(await exampleLoader()()) })
    await screen.findByRole('textbox')
    await act(async () => { command.resolve([{ type: 'text', text: 'Obsolete command' }]) })
    expect(screen.queryByText('Obsolete command')).toBeNull()
    const newInput = screen.getByRole('textbox')
    fireEvent.change(newInput, { target: { value: 'history' } })
    fireEvent.keyDown(newInput, { key: 'Enter' })
    expect(await screen.findByText('1. history')).toBeTruthy()
    expect(screen.queryByText('1. about')).toBeNull()
    expect(newLoad).toHaveBeenCalledTimes(1)
  })

  it('no restaura una sesión antigua al volver a un cargador anterior', async () => {
    const application = await exampleLoader()()
    const pending = deferred<typeof application>()
    const load = vi.fn<() => Promise<typeof application>>()
      .mockResolvedValueOnce(application).mockReturnValue(pending.promise)
    const { rerender } = render(<App load={load} />)
    await screen.findByRole('textbox')
    rerender(<App load={() => new Promise(() => {})} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    rerender(<App load={load} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Cargando…')
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await act(async () => { pending.resolve(await exampleLoader()()) })
    expect(await screen.findByRole('textbox')).toBeTruthy()
  })
})


it('conecta el arranque real de Vite con el prompt y el ejecutor sin recargar la configuración', async () => {
  vi.stubEnv('VITE_CONTENT_BASE_URL', 'https://example.com/content/')
  const fetch = exampleFetch()
  const json = fetch.getMockImplementation()!
  fetch.mockImplementation(async (input) => String(input).endsWith('.md')
    ? new Response('# Presentación desde el proveedor') : json(input))
  vi.stubGlobal('fetch', fetch)
  render(<App />)
  const input = await screen.findByRole('textbox', { name: 'Comando' })
  fireEvent.change(input, { target: { value: 'about' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(await screen.findByRole('heading', { name: 'Presentación desde el proveedor' })).toBeTruthy()
  fireEvent.change(input, { target: { value: 'about' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Presentación desde el proveedor' })).toHaveLength(2))
  expect(fetch).toHaveBeenCalledTimes(4)
  vi.unstubAllEnvs()
})
