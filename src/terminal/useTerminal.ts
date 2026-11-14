import { useEffect, useRef, useState } from 'react'
import type { CommandExecutor } from '../core/CommandExecutor'
import type { CommandLocale, CommandResult } from '../core/commandResults'
import type { TerminalEntryData } from './types'

export function useTerminal(executor: Pick<CommandExecutor, 'execute'>, locale: CommandLocale) {
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [entries, setEntries] = useState<TerminalEntryData[]>([])
  const [pending, setPending] = useState(false)
  const locked = useRef(false)
  const nextId = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function submit() {
    // Solo descarta espacio vacío; el parser del ejecutor conserva toda la sintaxis.
    if (locked.current || !input.trim()) return
    locked.current = true
    const command = input
    const id = String(++nextId.current)
    const history = [...commandHistory]
    setInput('')
    setPending(true)
    setCommandHistory([...history, command])
    setEntries((current) => [...current, { id, command, status: 'pending', results: [] }])
    try {
      let results: CommandResult[]
      try {
        results = await executor.execute(command, { history })
      } catch (cause) {
        results = [{ type: 'error', code: 'CONTENT_ERROR', cause,
          message: locale === 'es' ? 'No se pudo ejecutar la instrucción. Inténtalo de nuevo.' : 'Could not execute the instruction. Please try again.' }]
      }
      if (!mounted.current) return
      if (results.some((result) => result.type === 'clear')) {
        setEntries([])
      } else {
        setEntries((current) => current.map((entry) => entry.id === id ? {
          ...entry, results, status: results.some((result) => result.type === 'error') ? 'error' : 'success',
        } : entry))
      }
    } finally {
      locked.current = false
      if (mounted.current) setPending(false)
    }
  }
  return { input, setInput, submit, commandHistory, entries, pending }
}
