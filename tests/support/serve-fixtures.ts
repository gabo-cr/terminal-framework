/// <reference types="node" />
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const fixtureDirectory = fileURLToPath(new URL('../fixtures/external-site/', import.meta.url))

// Servidor estático de pruebas: sin fallback de SPA, con 404 reales y CORS público.
export function createFixtureServer(directory = fixtureDirectory) {
  const root = resolve(directory)
  return createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Cache-Control', 'no-store')
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405).end()
      return
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
      const path = resolve(root, `.${pathname}`)
      if (!path.startsWith(root + sep)) {
        response.writeHead(403).end()
        return
      }
      const body = await readFile(path)
      response.setHeader('Content-Type', path.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8')
      response.writeHead(200).end(request.method === 'HEAD' ? undefined : body)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      response.writeHead(code === 'ENOENT' || code === 'EISDIR' ? 404 : 400).end('Not Found')
    }
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.FIXTURE_PORT ?? 4174)
  const server = createFixtureServer()
  server.listen(port, '127.0.0.1', () => {
    console.log(`Fixtures: http://127.0.0.1:${port}/`)
  })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => { server.closeAllConnections(); server.close() })
  }
}
