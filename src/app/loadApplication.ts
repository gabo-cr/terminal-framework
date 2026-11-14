import { bootstrapApplication } from './bootstrapApplication'

// Adaptador de Vite para el motor completo; la UI de presentación sigue separada.
export function loadApplication() {
  return bootstrapApplication({
    baseUrl: import.meta.env.VITE_CONTENT_BASE_URL,
    development: import.meta.env.DEV,
  })
}
