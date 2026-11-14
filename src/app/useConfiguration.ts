import { useEffect, useRef, useState } from 'react'
import type { Configuration } from '../configuration/ConfigurationLoader'

export type ConfigurationState<T = Configuration> =
  | { status: 'loading' }
  | { status: 'ready'; configuration: T }
  | { status: 'error'; error: unknown }

export function useConfiguration<T>(load: () => Promise<T>) {
  const [source, setSource] = useState({ load, attempt: 0 })
  const { attempt } = source
  // Cada cambio de cargador inicia una sesión, incluso si se vuelve a uno anterior.
  if (source.load !== load) setSource({ load, attempt: attempt + 1 })
  const [settled, setSettled] = useState<{
    load: typeof load
    attempt: number
    state: ConfigurationState<T>
  } | null>(null)
  const request = useRef<{
    load: typeof load
    attempt: number
    promise: Promise<T>
  } | null>(null)

  useEffect(() => {
    let active = true
    // Comparte el arranque entre las dos activaciones del efecto en StrictMode.
    // Un reintento o un cargador distinto crea una sesión nueva, sin caché global.
    if (request.current?.load !== load || request.current.attempt !== attempt) {
      request.current = { load, attempt, promise: Promise.resolve().then(load) }
    }
    void request.current.promise.then(
      (configuration) => {
        if (active) setSettled({ load, attempt, state: { status: 'ready', configuration } })
      },
      (error: unknown) => {
        if (active) setSettled({ load, attempt, state: { status: 'error', error } })
      },
    )
    return () => { active = false }
  }, [load, attempt])

  function retry() {
    setSource((current) => ({ ...current, attempt: current.attempt + 1 }))
  }
  // Retira la sesión anterior en el mismo render que cambia el cargador.
  const state: ConfigurationState<T> = source.load === load && settled?.load === load && settled.attempt === attempt
    ? settled.state : { status: 'loading' }
  return { state, retry }
}
