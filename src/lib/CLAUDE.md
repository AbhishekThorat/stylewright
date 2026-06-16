# src/lib — core logic

Pure, framework-free, browser-agnostic logic. This is where branching logic
belongs (so it can be unit-tested without a browser). Keep the UI and the
service worker thin by pushing decisions down here.

## Files

- **`match.ts`** — hostname normalization and match resolution. Defaults: strip
  a single leading `www.`, keep the port only when present, exact host. The
  `domain`/`url-prefix`/`regex` match types are forward-compatible seams; v1
  only writes `host`.
- **`storage.ts`** — the schema and its operations. `chrome.storage.local` is
  the source of truth. The pure helpers (`selectEntryForUrl`, `migrate`,
  `parseImport`) are unit-tested; the `async` functions are thin
  `chrome.storage` wrappers. Bump `SCHEMA_VERSION` and extend `migrate` for any
  schema change — never silently reshape stored data.
- **`inject.ts`** — ⚠️ these functions are serialized and run **in the page**.
  They must be fully self-contained: no imports, no references to module scope.
  That's why the element id is a repeated literal. Don't "DRY" it against
  `STYLE_ELEMENT_ID` inside the function bodies.
- **`messages.ts`** — the typed contract between panel and worker. Every
  page-acting request carries an explicit `tabId`.

## Rules

- No DOM access here except inside the page-injected functions in `inject.ts`.
- Every change with logic gets a test in `__tests__/`.
- Storage entries are keyed by an opaque `id`; the `match` object decides
  applicability. Never key by raw hostname.
