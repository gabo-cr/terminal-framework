export type ConfigurationErrorKind =
  | 'invalid-base-url'
  | 'unsafe-path'
  | 'network'
  | 'http'
  | 'invalid-json'
  | 'validation'

export class ConfigurationError extends Error {
  readonly kind: ConfigurationErrorKind
  readonly url: string | undefined
  readonly status: number | undefined

  constructor(
    kind: ConfigurationErrorKind,
    message: string,
    url?: string,
    status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ConfigurationError'
    this.kind = kind
    this.url = url
    this.status = status
  }
}
