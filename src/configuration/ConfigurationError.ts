export type ConfigurationErrorKind =
  | 'invalid-base-url'
  | 'unsafe-path'
  | 'network'
  | 'http'
  | 'invalid-json'
  | 'validation'
  | 'cross-validation'

const errorCodes = {
  'invalid-base-url': 'INVALID_BASE_URL',
  'unsafe-path': 'UNSAFE_PATH',
  network: 'NETWORK_ERROR',
  http: 'HTTP_ERROR',
  'invalid-json': 'INVALID_JSON',
  validation: 'SCHEMA_VALIDATION_ERROR',
  'cross-validation': 'CROSS_VALIDATION_ERROR',
} as const

export type ConfigurationErrorCode = typeof errorCodes[ConfigurationErrorKind]

export interface ConfigurationIssue {
  code: 'COMMAND_CONFLICT' | 'DOCUMENT_NOT_FOUND' | 'COLLECTION_NOT_FOUND'
    | 'INTRO_NOT_FOUND' | 'COLLECTION_DOCUMENT_NOT_FOUND'
    | 'DUPLICATE_COLLECTION_DOCUMENT' | 'RESERVED_COLLECTION_DOCUMENT' | 'UNSAFE_DOCUMENT_PATH'
  file: 'commands.json' | 'content.json'
  path: (string | number)[]
  value: string
  message: string
  conflictingPath?: (string | number)[]
}

export class ConfigurationError extends Error {
  readonly kind: ConfigurationErrorKind
  readonly url: string | undefined
  readonly status: number | undefined
  readonly code: ConfigurationErrorCode
  readonly details: readonly ConfigurationIssue[]

  constructor(
    kind: ConfigurationErrorKind,
    message: string,
    url?: string,
    status?: number,
    options?: ErrorOptions & { details?: readonly ConfigurationIssue[] },
  ) {
    super(message, options)
    this.name = 'ConfigurationError'
    this.kind = kind
    this.url = url
    this.status = status
    this.code = errorCodes[kind]
    this.details = options?.details ?? []
  }
}
