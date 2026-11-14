import type { ConfigurationLoaderOptions } from '../configuration/ConfigurationLoader'
import { normalizeContentBaseUrl } from '../configuration/urls'
import { bootstrapConfiguration } from './bootstrap'
import { createCommandRuntime } from './createCommandRuntime'

/** Arranque sin React: configuración estricta y un motor con contenidos por sesión. */
export async function bootstrapApplication(options: ConfigurationLoaderOptions) {
  const configuration = await bootstrapConfiguration(options)
  const runtime = createCommandRuntime(configuration, {
    baseUrl: normalizeContentBaseUrl(options.baseUrl, options.development),
    development: options.development,
    fetch: options.fetch,
  })
  return { configuration, ...runtime }
}
