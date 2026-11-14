import { bootstrapConfiguration } from './bootstrap'

// Solo la capa de arranque conoce las variables de Vite.
export function loadConfiguration() {
  return bootstrapConfiguration({
    baseUrl: import.meta.env.VITE_CONTENT_BASE_URL,
    development: import.meta.env.DEV,
  })
}
