export type ContentErrorCode = 'DOCUMENT_NOT_FOUND' | 'INVALID_BASE_URL' | 'UNSAFE_PATH'
  | 'NETWORK_ERROR' | 'HTTP_ERROR'

export interface ContentErrorDetails {
  documentId?: string
  url?: string
  status?: number
}

export class ContentError extends Error {
  readonly code: ContentErrorCode
  readonly documentId: string | undefined
  readonly url: string | undefined
  readonly status: number | undefined

  constructor(code: ContentErrorCode, message: string, details: ContentErrorDetails = {}, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ContentError'
    this.code = code
    this.documentId = details.documentId
    this.url = details.url
    this.status = details.status
  }
}
