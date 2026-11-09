export interface ImageSelection { from: number; to: number }

export interface PastedImage {
  name: string
  mimeType: string
  bytes: Uint8Array
}

export interface ImageInsertionRequest {
  documentPath: string
  content: string
  selection: ImageSelection
  /** Omitted for the native image-file picker. */
  pastedImages?: PastedImage[]
}

export interface ImageInsertionSuccess {
  success: true
  path: string
  content: string
  /** Existing content after resource relocation, before inserting new images. */
  baseContent: string
  change: { from: number; to: number; insert: string }
  cursor: number
  imagePaths: string[]
}

export type ImageInsertionResult = ImageInsertionSuccess | {
  success: false
  error: string
  cancelled?: boolean
}
