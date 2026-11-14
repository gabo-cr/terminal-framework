import { z } from 'zod'
import { nonEmptyStringSchema } from './fields'

const welcomeMessages = {
  es: 'Bienvenido. Escribe help para explorar el sitio.',
  en: 'Welcome. Type help to explore the site.',
}

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)

export const siteSchema = z.strictObject({
  version: z.literal(1),
  name: nonEmptyStringSchema,
  description: nonEmptyStringSchema,
  locale: z.enum(['es', 'en']).default('es'),
  terminal: z.strictObject({
    welcome: z.string().optional(),
  }).prefault({}),
  theme: z.strictObject({
    accentColor: hexColorSchema.default('#96D9A5'),
    terminalBackground: hexColorSchema.default('#292C32'),
  }).prefault({}),
}).transform((site) => ({
  ...site,
  terminal: {
    ...site.terminal,
    welcome: site.terminal.welcome ?? welcomeMessages[site.locale],
  },
}))

export type SiteConfigInput = z.input<typeof siteSchema>
export type SiteConfig = z.output<typeof siteSchema>
