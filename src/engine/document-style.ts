export type DocumentStyle = 'standard' | 'homework'

export function normalizeDocumentStyle(value: unknown): DocumentStyle {
  return value === 'homework' ? 'homework' : 'standard'
}
