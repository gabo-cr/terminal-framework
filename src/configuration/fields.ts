import { z } from 'zod'

export const nonEmptyStringSchema = z.string().refine(
  (value) => value.trim().length > 0,
  'Debe contener texto no vacío.',
)

// Segmentos alfanuméricos en minúsculas, separados por un solo guion.
export const contentIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
