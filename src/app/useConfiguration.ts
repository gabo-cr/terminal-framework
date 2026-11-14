import { useEffect, useState } from 'react'
import type { Configuration } from '../configuration/ConfigurationLoader'

export type ConfigurationState<T = Configuration> =
  | { status: 'loading' }
  | { status: 'ready'; configuration: T }
  | { status: 'error'; error: unknown }

export function useConfiguration<T>(load: () => Promise<T>) {
  const [state, setState] = useState<ConfigurationState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void Promise.resolve().then(load).then(
      (configuration) => { if (active) setState({ status: 'ready', configuration }) },
      (error: unknown) => { if (active) setState({ status: 'error', error }) },
    )
    return () => { active = false }
  }, [load, attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }
  return { state, retry }
}
