import type { CommandRegistry } from './CommandRegistry'

/** Nombres y alias en orden del registro, sin crear otro registro de configuración. */
export function registeredCommandTokens(registry: CommandRegistry) {
  return registry.list().flatMap((command) => [command.name,
    ...(command.kind === 'custom' ? command.aliases ?? [] : []),
  ].map((name) => ({ name, command })))
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  let beforePrevious: number[] | undefined
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) {
      current[column] = Math.min(current[column - 1]! + 1, previous[column]! + 1,
        previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1))
      // Una transposición adyacente (hlep → help) cuenta como una edición.
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2]
        && left[row - 2] === right[column - 1]) {
        current[column] = Math.min(current[column]!, beforePrevious![column - 2]! + 1)
      }
    }
    beforePrevious = previous
    previous = current
  }
  return previous[right.length]!
}

/** Hasta tres alternativas; no interpreta entradas completas ni ejecuta comandos. */
export function suggestCommands(name: string, registry: CommandRegistry): string[] {
  if (!name || /\s/.test(name)) return []
  const input = name.toLowerCase()
  const seen = new Set<string>()
  return registeredCommandTokens(registry).flatMap(({ name: candidate }, index) => {
    const normalized = candidate.toLowerCase()
    if (seen.has(normalized) || normalized.startsWith('-')) return []
    seen.add(normalized)
    // Tokens cortos: solo cambio de mayúsculas. De 3 a 5: una edición; desde 6: dos.
    const limit = Math.min(input.length, normalized.length) < 3 ? 0
      : Math.min(input.length, normalized.length) < 6 ? 1 : 2
    if (Math.abs(input.length - normalized.length) > limit) return []
    const distance = editDistance(input, normalized)
    return distance <= limit ? [{ name: candidate, distance, index }] : []
  }).sort((left, right) => left.distance - right.distance || left.index - right.index)
    .slice(0, 3).map(({ name }) => name)
}
