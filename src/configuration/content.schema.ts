import { z } from 'zod'
import { contentIdSchema, nonEmptyStringSchema } from './fields'

export const documentSchema = z.strictObject({
  id: contentIdSchema,
  title: nonEmptyStringSchema,
  description: z.string().optional(),
  path: nonEmptyStringSchema,
  format: z.literal('markdown'),
})

export const collectionSchema = z.strictObject({
  id: contentIdSchema,
  title: nonEmptyStringSchema,
  description: z.string().optional(),
  intro: contentIdSchema,
  documents: z.array(contentIdSchema).superRefine((ids, context) => {
    const seen = new Set<string>()
    ids.forEach((id, index) => {
      if (seen.has(id)) {
        context.addIssue({ code: 'custom', path: [index], message: `ID repetido: ${id}` })
      }
      seen.add(id)
    })
  }),
})

export const contentSchema = z.strictObject({
  version: z.literal(1),
  collections: z.array(collectionSchema),
  documents: z.array(documentSchema),
}).superRefine((catalog, context) => {
  for (const kind of ['collections', 'documents'] as const) {
    const seen = new Set<string>()
    catalog[kind].forEach(({ id }, index) => {
      if (seen.has(id)) {
        context.addIssue({
          code: 'custom',
          path: [kind, index, 'id'],
          message: `ID repetido: ${id}`,
        })
      }
      seen.add(id)
    })
  }
})

export type ContentDocument = z.infer<typeof documentSchema>
export type ContentCollection = z.infer<typeof collectionSchema>
export type ContentConfig = z.infer<typeof contentSchema>
