import { ConfigurationLoader } from '../configuration/ConfigurationLoader'
import type { Configuration, ConfigurationLoaderOptions } from '../configuration/ConfigurationLoader'
import { validateConfiguration } from '../configuration/validateConfiguration'

// Sin React ni Vite. Solo resuelve cuando toda la configuración es válida;
// cualquier rechazo impide que el consumidor entre en ready.
export async function bootstrapConfiguration(options: ConfigurationLoaderOptions): Promise<Configuration> {
  const loader = new ConfigurationLoader(options)
  const configuration = await loader.load()
  validateConfiguration(configuration, loader.baseUrl, options.development)
  return configuration
}
