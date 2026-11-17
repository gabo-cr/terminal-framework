// @vitest-environment jsdom
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { App } from '../../src/app/App'
import { createFixtureServer, fixtureDirectory } from '../support/serve-fixtures'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

it.each(['es', 'en'] as const)('integra React, arranque, motor y contenidos HTTP en %s', async (locale) => {
  const directory = await mkdtemp(join(tmpdir(), 'terminal-ui-http-'))
  const server = createFixtureServer(directory)
  const requests: string[] = []
  server.on('request', (request) => requests.push(request.url ?? ''))
  try {
    await cp(fixtureDirectory, directory, { recursive: true })
    const sitePath = join(directory, 'config/site.json')
    const site = JSON.parse(await readFile(sitePath, 'utf8'))
    await writeFile(sitePath, JSON.stringify({ ...site, locale }))
    const listening = once(server, 'listening')
    server.listen(0, '127.0.0.1')
    await listening
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No HTTP address')
    vi.stubEnv('VITE_CONTENT_BASE_URL', `http://127.0.0.1:${address.port}/`)
    vi.stubEnv('DEV', true)
    render(<StrictMode><App /></StrictMode>)
    const input = await screen.findByRole('combobox', { name: locale === 'es' ? 'Comando' : 'Command' })
    expect(requests.slice().sort()).toEqual(['/config/site.json', '/config/commands.json', '/config/content.json'].sort())
    expect(document.documentElement.lang).toBe(locale)
    const region = screen.getByRole('region', { name: locale === 'es' ? 'Ejecuciones anteriores' : 'Previous executions' })
    const commands: string[] = []
    async function execute(command: string) {
      commands.push(command)
      fireEvent.change(input, { target: { value: command } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await waitFor(() => expect(input.getAttribute('aria-busy')).toBe('false'))
      return region.querySelector('[data-terminal-entry]:last-child') as HTMLElement
    }

    fireEvent.change(input, { target: { value: 'abo' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect((input as HTMLInputElement).value).toBe('about')
    expect(region.querySelector('[data-terminal-entry]')).toBeNull()
    fireEvent.change(input, { target: { value: 'h' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(screen.getByRole('listbox', { name: locale === 'es' ? 'Sugerencias de comandos' : 'Command suggestions' })).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()

    expect((await execute('help')).textContent).toContain(locale === 'es' ? 'Comandos disponibles' : 'Available commands')
    const help = await execute('help code')
    expect(within(help).getByRole('term').querySelector('span')?.textContent).toBe('code')
    expect(Array.from(within(help).getByRole('term').querySelectorAll('code'), (usage) => usage.textContent)).toEqual([
      'code', 'code list', `code <${locale === 'es' ? 'documento' : 'document'}>`,
    ])
    expect(within(help).getByRole('definition').textContent).toBe('Taller')
    for (const [command, heading] of [
      ['about', 'Presentación'], ['contact', 'Contacto'], ['code', 'Taller'],
      ['code react-hooks', 'React Hooks'], ['read', 'Biblioteca'], ['read cuento-001', 'La puerta azul'],
    ]) {
      const entry = await execute(command!)
      expect(within(entry).getByRole('heading', { name: heading })).toBeTruthy()
      if (command === 'code' || command === 'read') {
        expect(entry.textContent).toContain(locale === 'es'
          ? `Ejecuta ${command} list para ver todos los documentos.`
          : `Run ${command} list to see all documents.`)
      }
    }
    for (const [command, items] of [
      ['code list', ['typescript-notes — Notas de TypeScript', 'react-hooks — React Hooks']],
      ['read list', ['cuento-002 — El reloj de arena', 'cuento-001 — La puerta azul']],
    ] as const) {
      const entry = await execute(command)
      expect(within(entry).getAllByRole('listitem').map((item) => item.textContent)).toEqual(items)
    }
    const typo = await execute('hlep')
    expect(within(typo).getByText(locale === 'es' ? /Quizá quisiste decir/ : /Did you mean/).textContent).toContain('help')
    expect(within(await execute('unknown')).getByRole('alert').textContent).toBe(locale === 'es'
      ? 'No existe el comando: unknown.' : 'Command not found: unknown.')
    for (const command of ['code nonexistent', 'code cuento-001']) {
      expect(within(await execute(command)).getByRole('alert').textContent).toBe(locale === 'es'
        ? 'El documento no pertenece a esta colección.' : 'The document does not belong to this collection.')
    }
    expect(within(await execute('about extra')).getByRole('alert').textContent).toBe(locale === 'es'
      ? 'Este comando no acepta argumentos.' : 'This command does not accept arguments.')
    expect(within(await execute('missing')).getByRole('alert').textContent).toBe(locale === 'es'
      ? 'No se pudo cargar el contenido. Inténtalo de nuevo.' : 'Could not load the content. Please try again.')
    await writeFile(join(directory, 'documents/remote-missing.md'), '# Recuperado\n')
    expect(within(await execute('missing')).getByRole('heading', { name: 'Recuperado' })).toBeTruthy()
    expect(requests.filter((path) => path === '/documents/remote-missing.md')).toHaveLength(2)
    await execute('clear')
    expect(region.querySelector('[data-terminal-entry]')).toBeNull()
    expect(within(region).getByText(site.terminal.welcome)).toBeTruthy()
    expect(within(await execute('  acerca  ')).getByRole('heading', { name: 'Presentación' })).toBeTruthy()
    expect(requests.filter((path) => path === '/documents/about.md')).toHaveLength(1)
    const history = await execute('history')
    expect(within(history).getAllByRole('listitem').map((item) => item.textContent)).toEqual(commands.map((command, i) => `${i + 1}. ${command}`))
    expect(requests.filter((path) => path.startsWith('/config/'))).toHaveLength(3)
  } finally {
    cleanup()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})

it('ejecuta una segunda configuración independiente con React y contenidos HTTP reales', async () => {
  const server = createFixtureServer(join(fixtureDirectory, '../ui-site'))
  try {
    const listening = once(server, 'listening')
    server.listen(0, '127.0.0.1')
    await listening
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('No HTTP address')
    vi.stubEnv('VITE_CONTENT_BASE_URL', `http://127.0.0.1:${address.port}/`)
    vi.stubEnv('DEV', true)
    render(<StrictMode><App /></StrictMode>)
    const input = await screen.findByRole('combobox', { name: 'Comando' })
    expect(screen.getByRole('heading', { name: 'Cuaderno de ejemplo' })).toBeTruthy()
    async function execute(command: string) {
      fireEvent.change(input, { target: { value: command } })
      fireEvent.keyDown(input, { key: 'Enter' })
      await waitFor(() => expect(input.getAttribute('aria-busy')).toBe('false'))
      return screen.getByRole('region', { name: 'Ejecuciones anteriores' }).querySelector('[data-terminal-entry]:last-child') as HTMLElement
    }
    expect(within(await execute('acerca')).getByRole('heading', { name: 'El cuaderno' })).toBeTruthy()
    expect(within(await execute('essays')).getByRole('heading', { name: 'El cuaderno' })).toBeTruthy()
    expect(within(await execute('essays list')).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'first-essay — Una máquina y un poema',
    ])
    expect(within(await execute('essays first-essay')).getByRole('heading', { name: 'Una máquina y un poema' })).toBeTruthy()
    const help = await execute('help')
    expect(within(help).getAllByRole('term').map((term) => term.querySelector('span')?.textContent)).toEqual([
      'help', 'clear', 'history', 'about', 'essays',
    ])
    expect(document.activeElement).toBe(input)
  } finally {
    cleanup()
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
