import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { loadConfiguration } from './app/loadConfiguration'
import './styles/index.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el elemento raíz de la aplicación.')
}

async function bootstrap(element: HTMLElement) {
  await loadConfiguration()
  createRoot(element).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap(root).catch((error: unknown) => {
  console.error('No se pudo inicializar la configuración.', error)
})
