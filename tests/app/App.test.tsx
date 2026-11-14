// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import siteJson from '../fixtures/ui-site/config/site.json?raw'
import commandsJson from '../fixtures/ui-site/config/commands.json?raw'
import contentJson from '../fixtures/ui-site/config/content.json?raw'

const exampleName: string = JSON.parse(siteJson).name
const examples: Record<string, string> = { 'site.json': siteJson, 'commands.json': commandsJson, 'content.json': contentJson }
import { App } from '../../src/app/App'
import { bootstrapConfiguration } from '../../src/app/bootstrap'

function exampleFetch(invalid = false) {
  return vi.fn<typeof globalThis.fetch>(async (input) => {
    const filename = new URL(String(input)).pathname.split('/').at(-1)
    const data = JSON.parse(examples[filename!]!)
    if (invalid && filename === 'site.json') data.version = 99
    return Response.json(data)
  })
}

function exampleLoader(fetch = exampleFetch()) {
  return () => bootstrapConfiguration({ baseUrl: 'http://localhost:5173/example-content', development: true, fetch })
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

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
    expect(screen.getByRole('textbox', { name: 'Comando' }).hasAttribute('readonly')).toBe(true)
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
    const load = vi.fn(exampleLoader())
    render(<StrictMode><App load={load} /></StrictMode>)
    await waitFor(() => expect(screen.getByRole('heading', { name: exampleName })).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
