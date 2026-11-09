# Image insertion implementation plan

> Implement in the current session with focused tests and independent review.

**Goal:** Paste images or choose them with an Insert Image button, automatically maintaining a portable Markdown document folder and numbered images, then release a new desktop version.

**Architecture:** Electron owns dialogs and filesystem transactions. The renderer submits the current Markdown and selection; the editor applies the returned insertion and adopts its saved document path. Source-aware resource rewriting preserves Markdown, links, code examples and image references.

**Decisions:** Bundle layout is `<document stem>/<original filename>` beside `<document stem>/images/1.ext`. Prefer an existing matching document folder; otherwise create a sibling folder, with a unique suffix on collision. Preserve original image files, copy existing local images into the bundle on first organization, rebase other relative links, and remove the old Markdown only after the new bundle is complete. Missing images or write errors stop the operation with the original document intact. An unsaved document first asks for a save location. Images use the highest existing numeric index plus one, across extensions; multiple selected images are supported. Cancel changes nothing. The persisted display style remains compatible.

## Interfaces

- Shared request/result types: `src/shared/image-insertion.ts`.
- `electron/markdown-assets.ts`: `rewriteMarkdownResources(content, rewrite)` returns `{ content, mapPosition(position) }`; rewrite receives `(url, kind: 'image' | 'link')` and returns a replacement URL. It preserves code and unrelated source text.
- `electron/document-images.ts`: `insertDocumentImages({documentPath,content,selection,images})` returns `ImageInsertionSuccess`; images are `{data: Uint8Array, extension: string}`. Filesystem operations complete before success.
- IPC `images:insert`, preload `insertImages(request): Promise<ImageInsertionResult>`.
- Editor emits `paste-images(files, selection)`, exposes `getSelection()` and `applyImageInsertion(result)`; application freezes editing during insertion and updates path, saved state, image cache and preview on success.

## Work

- [x] Source-aware resource rewrite: image URLs, references and HTML attributes; normal links rebase; code examples and rendered formulas unchanged; offset mapping tested.
- [x] Filesystem bundle: sequential numbering, duplicate-directory collision, existing bundle reuse, safe migration, saved/unsaved documents, error rollback and image-byte preservation tested with real temporary files.
- [x] Editor and UI: native chooser button, clipboard image paste, selection insertion, unsaved save-location dialog, busy/cancel/error states and path adoption; normal text paste remains normal.
- [x] Actual Electron end-to-end checks exercise clipboard paste, file-picker integration, reopening the relocated document, saving, native-file drag/drop and PDF export with embedded images.
- [x] Release readiness: 160 tests, type checking, build, independent review, release notes and version 1.3.0. Publish the tag and verify both platform packages through the existing release workflow.

## Review focus

- Do not overwrite an existing folder, document or image, including different extensions sharing the same numeric index.
- Do not lose unsaved editor content, break existing relative assets, or move unrelated files.
- Cancellation and image-read/write errors must leave the original usable; concurrent insertions must serialize.
- Markdown code examples and normal text clipboard content must retain their contents.
- An insertion updates the visible file path and later save/export actions; undo removes the insertion without undoing resource relocation.
