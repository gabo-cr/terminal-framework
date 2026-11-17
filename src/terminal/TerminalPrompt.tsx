import { useEffect, useId, useRef, useState } from 'react'
import type { CompletionEngine, CompletionSuggestion } from '../core/CompletionEngine'
import type { CommandLocale } from '../core/commandResults'

export function TerminalPrompt({ label, value = '', onChange, onSubmit, pending = false, onHistoryPrevious, onHistoryNext, completion, locale = 'es' }: {
  label: string; value?: string; onChange?: (value: string) => void; onSubmit?: () => void; pending?: boolean
  onHistoryPrevious?: () => void; onHistoryNext?: () => void
  completion?: Pick<CompletionEngine, 'complete'>; locale?: CommandLocale
}) {
  const input = useRef<HTMLInputElement>(null)
  const composing = useRef(false)
  const listId = useId()
  const [menu, setMenu] = useState<{ value: string; items: readonly CompletionSuggestion[]; selected: number } | null>(null)
  const visible = !pending && menu?.value === value ? menu : null
  const selectedOption = useRef<HTMLLIElement>(null)
  useEffect(() => { input.current?.focus({ preventScroll: true }) }, [])
  useEffect(() => { if (pending) setMenu(null) }, [pending])
  useEffect(() => {
    // Desplazar solo la lista, sin mover la página ni las respuestas.
    const option = selectedOption.current
    const list = option?.parentElement
    if (!option || !list) return
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight
    }
  }, [visible?.selected, visible?.value])

  function atEnd() {
    const field = input.current
    return field?.selectionStart === value.length && field.selectionEnd === value.length
  }
  function matches(text: string) {
    const result = completion?.complete(text)
    return !result || result.type === 'empty' ? [] : result.type === 'candidate' ? [result.candidate] : result.suggestions
  }
  function apply(suggestion: CompletionSuggestion) {
    if (pending || composing.current || !onChange) return
    onChange(suggestion.insertValue)
    setMenu(null)
    input.current?.focus({ preventScroll: true })
  }
  return (
    <div className="relative mt-3 min-w-0 shrink-0 border-t border-white/10 pt-3 text-[var(--terminal-command)]">
      {visible && <ul id={listId} role="listbox" aria-label={locale === 'es' ? 'Sugerencias de comandos' : 'Command suggestions'}
        className="terminal-scrollbar absolute inset-x-0 bottom-full z-10 mb-2 max-h-[min(40dvh,16rem)] overflow-y-auto overscroll-contain rounded-md border border-white/15 bg-[var(--terminal-background,#292C32)] p-1 shadow-lg">
        {visible.items.map((item, index) => <li key={`${item.kind}:${item.name}`} id={`${listId}-${index}`} role="option" aria-selected={index === visible.selected}
          ref={index === visible.selected ? selectedOption : undefined}
          onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()}
          onClick={() => apply(item)}
          className={`cursor-pointer rounded-sm px-3 py-2 [overflow-wrap:anywhere] ${index === visible.selected ? 'bg-white/10 ring-1 ring-inset ring-[var(--terminal-accent)]' : 'hover:bg-white/5'}`}>
          <span className="font-semibold">{item.name}</span>
          {item.description && <span className="ml-3 text-xs text-zinc-400">{item.description}</span>}
        </li>)}
      </ul>}
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="select-none">$</span>
        <input ref={input} type="text" name="terminal-command" aria-label={label}
          role={completion ? 'combobox' : undefined} aria-autocomplete={completion ? 'list' : undefined}
          aria-expanded={completion ? !!visible : undefined} aria-controls={visible ? listId : undefined}
          aria-activedescendant={visible ? `${listId}-${visible.selected}` : undefined} aria-haspopup={completion ? 'listbox' : undefined}
          value={value} readOnly={!onChange || pending} aria-busy={pending}
          onBlur={() => setMenu(null)}
          onCompositionStart={() => { composing.current = true; setMenu(null) }}
          onCompositionEnd={() => { composing.current = false }}
          onSelect={() => { if (!atEnd()) setMenu(null) }}
          onKeyUp={() => { if (!atEnd()) setMenu(null) }}
          onClick={() => { if (!atEnd()) setMenu(null) }}
          onChange={(event) => {
            const next = event.target.value
            onChange?.(next)
            if (!visible || composing.current || event.target.selectionStart !== next.length || event.target.selectionEnd !== next.length) { setMenu(null); return }
            const items = matches(next)
            setMenu(items.length ? { value: next, items, selected: 0 } : null)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing.current) return
            if (event.key === 'Escape') { if (visible) event.preventDefault(); setMenu(null); return }
            if (event.key === 'Tab') {
              if (pending || !onChange || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || !atEnd()) { setMenu(null); return }
              if (visible) { event.preventDefault(); apply(visible.items[visible.selected]!); return }
              const items = matches(value)
              if (!items.length || (items.length === 1 && items[0]!.insertValue === value)) return
              event.preventDefault()
              if (items.length === 1) apply(items[0]!)
              else setMenu({ value, items, selected: 0 })
              return
            }
            if (!pending && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
              if (visible && atEnd() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                event.preventDefault()
                setMenu({ ...visible, selected: (visible.selected + (event.key === 'ArrowDown' ? 1 : -1) + visible.items.length) % visible.items.length })
                return
              }
              const navigate = event.key === 'ArrowUp' ? onHistoryPrevious : event.key === 'ArrowDown' ? onHistoryNext : undefined
              if (navigate) { event.preventDefault(); setMenu(null); navigate(); return }
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              setMenu(null)
              if (!event.repeat && !pending) onSubmit?.()
            }
          }}
          autoComplete="off" autoCapitalize="none" spellCheck={false}
          className="min-w-0 flex-1 rounded-sm bg-transparent py-1 text-base text-inherit caret-current outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current sm:text-[13px]"
        />
      </div>
    </div>
  )
}
