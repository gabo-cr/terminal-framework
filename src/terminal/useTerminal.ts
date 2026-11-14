import { useEffect, useRef, useState } from 'react'
import type { CommandExecutor } from '../core/CommandExecutor'
import type { CommandLocale, CommandResult } from '../core/commandResults'
import type { TerminalEntryData } from './types'

export function useTerminal(executor: Pick<CommandExecutor, 'execute'>, locale: CommandLocale) {
  const [input, updateInput] = useState('')
  const inputValue = useRef('')
  const historyPosition = useRef<number | null>(null)
  const draft = useRef('')
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

  function setInput(value: string) {
    inputValue.current = value
    updateInput(value)
  }

  function navigateHistory(direction: 'previous' | 'next') {
    if (locked.current || commandHistory.length === 0) return
    const position = historyPosition.current
    if (direction === 'previous') {
      if (position === null) draft.current = inputValue.current
      const next = position === null ? commandHistory.length - 1 : Math.max(0, position - 1)
      historyPosition.current = next
      setInput(commandHistory[next]!)
    } else if (position !== null) {
      if (position + 1 < commandHistory.length) {
        historyPosition.current = position + 1
        setInput(commandHistory[position + 1]!)
      } else {
        historyPosition.current = null
        setInput(draft.current)
      }
    }
  }

  async function submit() {
    // Solo descarta espacio vacío; el parser del ejecutor conserva toda la sintaxis.
    if (locked.current || !inputValue.current.trim()) return
    locked.current = true
    const command = inputValue.current
    const id = String(++nextId.current)
    const history = [...commandHistory]
    setInput('')
    historyPosition.current = null
    draft.current = ''
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
  return { input, setInput, submit, commandHistory, entries, pending, navigateHistory }
}
