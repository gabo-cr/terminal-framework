import { useEffect } from 'react'
import type { bootstrapApplication } from './bootstrapApplication'
import { useTerminal } from '../terminal/useTerminal'
import { loadApplication } from './loadApplication'
import { useConfiguration } from './useConfiguration'
import { Terminal } from '../terminal/Terminal'

const messages = {
  es: { loading: 'Cargando…', error: 'No pudimos cargar el sitio.', detail: 'Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa, la configuración del sitio puede necesitar una revisión.', retry: 'Reintentar', history: 'Ejecuciones anteriores', input: 'Comando', pending: 'Ejecutando…' },
  en: { loading: 'Loading…', error: 'We could not load this site.', detail: 'Check your connection and try again. If the problem continues, the site configuration may need attention.', retry: 'Try again', history: 'Previous executions', input: 'Command', pending: 'Running…' },
}

type Application = Awaited<ReturnType<typeof bootstrapApplication>>

function SitePage({ application }: { application: Application }) {
  const { site } = application.configuration
  const terminal = useTerminal(application.executor, site.locale)
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
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
      <header className="mb-5 shrink-0 sm:mb-6">
        <div aria-hidden="true" className="mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: site.theme.accentColor }} />
        <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{site.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-snug text-zinc-600 [overflow-wrap:anywhere]">{site.description}</p>
      </header>
      <Terminal
        welcome={site.terminal.welcome}
        theme={site.theme}
        labels={messages[site.locale]}
        entries={terminal.entries}
        promptValue={terminal.input}
        onInputChange={terminal.setInput}
        onSubmit={() => { void terminal.submit() }}
        pending={terminal.pending}
        onHistoryPrevious={() => terminal.navigateHistory('previous')}
        onHistoryNext={() => terminal.navigateHistory('next')}
      />
    </div>
  )
}

export function App({ load = loadApplication, initialLocale = 'es' }: {
  load?: () => Promise<Application>
  initialLocale?: 'es' | 'en'
}) {
  const { state, retry } = useConfiguration(load)
  const text = messages[initialLocale]
  useEffect(() => {
    if (state.status !== 'ready') document.documentElement.lang = initialLocale
  }, [initialLocale, state.status])
  return (
    <main className="flex h-dvh flex-col overflow-y-auto bg-white px-4 py-5 text-zinc-900 sm:px-8 sm:py-8">
      {state.status === 'loading' && <p role="status" className="mx-auto max-w-3xl text-sm text-zinc-500">{text.loading}</p>}
      {state.status === 'error' && (
        <div role="alert" className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold">{text.error}</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600">{text.detail}</p>
          <button type="button" onClick={retry} className="mt-6 rounded-md bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900">{text.retry}</button>
        </div>
      )}
      {state.status === 'ready' && <SitePage application={state.configuration} />}
    </main>
  )
}
