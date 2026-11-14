import { ConfigurationLoader } from '../configuration/ConfigurationLoader'

// Solo la capa de arranque conoce las variables de Vite.
export function loadConfiguration() {
  return new ConfigurationLoader({
    baseUrl: import.meta.env.VITE_CONTENT_BASE_URL,
    development: import.meta.env.DEV,
  }).load()
}
