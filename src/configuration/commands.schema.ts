import { z } from 'zod'
import { contentIdSchema, nonEmptyStringSchema } from './fields'

const reservedNames = new Set(['help', 'clear', 'history'])
const commandNameSchema = z.string().regex(/^[a-z0-9-]+$/).refine(
  (name) => !reservedNames.has(name),
  'Nombre reservado para un comando integrado.',
)

const commonFields = {
  name: commandNameSchema,
  description: nonEmptyStringSchema,
  aliases: z.array(commandNameSchema).optional(),
}

export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...commonFields,
    type: z.literal('document'),
    content: contentIdSchema,
  }),
  z.strictObject({
    ...commonFields,
    type: z.literal('collection'),
    collection: contentIdSchema,
  }),
])

export const commandsSchema = z.strictObject({
  version: z.literal(1),
  commands: z.array(commandSchema),
})

export type Command = z.infer<typeof commandSchema>
export type CommandsConfig = z.infer<typeof commandsSchema>
