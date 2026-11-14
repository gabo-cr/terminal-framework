import { useEffect } from 'react'
import type { Configuration } from '../configuration/ConfigurationLoader'
import { loadConfiguration } from './loadConfiguration'
import { useConfiguration } from './useConfiguration'

const messages = {
  es: { loading: 'Cargando…', error: 'No pudimos cargar el sitio.', detail: 'Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa, la configuración del sitio puede necesitar una revisión.', retry: 'Reintentar', panel: 'Bienvenida' },
  en: { loading: 'Loading…', error: 'We could not load this site.', detail: 'Check your connection and try again. If the problem continues, the site configuration may need attention.', retry: 'Try again', panel: 'Welcome' },
}

function SitePage({ configuration }: { configuration: Configuration }) {
  const { site } = configuration
  useEffect(() => {
    document.title = site.name
    document.documentElement.lang = site.locale
    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!description) {
      description = document.createElement('meta')
      description.name = 'description'
      document.head.append(description)
    }
    description.content = site.description
  }, [site])

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8 sm:mb-12">
        <div aria-hidden="true" className="mb-6 h-1 w-10 rounded-full" style={{ backgroundColor: site.theme.accentColor }} />
        <h1 className="text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-5xl">{site.name}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 [overflow-wrap:anywhere] sm:text-lg">{site.description}</p>
      </header>
      <section aria-label={messages[site.locale].panel} className="min-h-56 rounded-xl border border-black/10 p-6 shadow-sm sm:min-h-72 sm:p-8" style={{ backgroundColor: site.theme.terminalBackground, color: site.theme.accentColor }}>
        <p className="whitespace-pre-wrap font-mono text-sm leading-7 [overflow-wrap:anywhere] sm:text-base">{site.terminal.welcome}</p>
      </section>
    </div>
  )
}

export function App({ load = loadConfiguration, initialLocale = 'es' }: {
  load?: () => Promise<Configuration>
  initialLocale?: 'es' | 'en'
}) {
  const { state, retry } = useConfiguration(load)
  const text = messages[initialLocale]
  useEffect(() => {
    if (state.status !== 'ready') document.documentElement.lang = initialLocale
  }, [initialLocale, state.status])
  return (
    <main className="min-h-screen bg-white px-5 py-12 text-zinc-900 sm:px-12 sm:py-20">
      {state.status === 'loading' && <p role="status" className="mx-auto max-w-3xl text-sm text-zinc-500">{text.loading}</p>}
      {state.status === 'error' && (
        <div role="alert" className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold">{text.error}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600">{text.detail}</p>
          <button type="button" onClick={retry} className="mt-6 rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900">{text.retry}</button>
        </div>
      )}
      {state.status === 'ready' && <SitePage configuration={state.configuration} />}
    </main>
  )
}
