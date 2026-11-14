import { useLayoutEffect, useRef } from 'react'
import type { TerminalEntryData } from './types'

export function useTerminalScroll(entries: readonly TerminalEntryData[], welcome: string) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const following = useRef(true)

  function onScroll() {
    const panel = viewport.current
    if (panel) following.current = panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 64
  }

  useLayoutEffect(() => {
    const panel = viewport.current
    const body = content.current
    if (!panel || !body) return
    function followRecent() {
      if (!panel || !body) return
      if (entries.length === 0) {
        panel.scrollTop = 0
        following.current = true
        return
      }
      if (!following.current) return
      const latest = body.querySelector<HTMLElement>('[data-terminal-entry]:last-child')
      // No saltar al final de un documento largo: mostrar el comienzo de la
      // ejecución nueva, manteniendo el desplazamiento dentro del panel.
      const top = Math.max(0, Math.min(panel.scrollHeight - panel.clientHeight, latest?.offsetTop ?? 0))
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true
      if (panel.scrollTo) panel.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
      else panel.scrollTop = top
    }
    followRecent()
    // Un cambio de tamaño no es una nueva ejecución: dejamos al navegador
    // conservar la posición de lectura al reajustar el documento.
  }, [entries, welcome])

  return { viewport, content, onScroll }
}
