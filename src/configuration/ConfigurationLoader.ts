import type { z } from 'zod'
import { commandsSchema } from './commands.schema'
import type { CommandsConfig } from './commands.schema'
import { contentSchema } from './content.schema'
import type { ContentConfig } from './content.schema'
import { siteSchema } from './site.schema'
import type { SiteConfig } from './site.schema'
import { ConfigurationError } from './ConfigurationError'
import { normalizeContentBaseUrl, resolveSafeRelativeUrl } from './urls'

export interface Configuration {
  site: SiteConfig
  commands: CommandsConfig
  content: ContentConfig
}

export interface ConfigurationLoaderOptions {
  baseUrl: string | undefined
  development?: boolean
  fetch?: typeof globalThis.fetch
}

export class ConfigurationLoader {
  readonly baseUrl: string
  private readonly development: boolean
  private readonly fetch: typeof globalThis.fetch

  constructor(options: ConfigurationLoaderOptions) {
    this.development = options.development ?? false
    this.baseUrl = normalizeContentBaseUrl(options.baseUrl, this.development)
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async load(): Promise<Configuration> {
    const [site, commands, content] = await Promise.all([
      this.loadFile('config/site.json', siteSchema),
      this.loadFile('config/commands.json', commandsSchema),
      this.loadFile('config/content.json', contentSchema),
    ])
    return { site, commands, content }
  }

  private async loadFile<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const url = resolveSafeRelativeUrl(this.baseUrl, path, this.development)
    let response: Response
    try {
      // No seguir redirecciones que podrían abandonar la raíz configurada.
      response = await this.fetch(url, { redirect: 'error', credentials: 'omit' })
    } catch (cause) {
      throw new ConfigurationError('network', `No se pudo descargar ${path}.`, url, undefined, { cause })
    }
    if (!response.ok) {
      throw new ConfigurationError('http', `HTTP ${response.status} al descargar ${path}.`, url, response.status)
    }
    let text: string
    try {
      text = await response.text()
    } catch (cause) {
      throw new ConfigurationError('network', `No se pudo leer ${path}.`, url, undefined, { cause })
    }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch (cause) {
      throw new ConfigurationError('invalid-json', `JSON inválido en ${path}.`, url, undefined, { cause })
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      throw new ConfigurationError('validation', `Configuración inválida en ${path}.`, url, undefined, { cause: parsed.error })
    }
    return parsed.data
  }
}
