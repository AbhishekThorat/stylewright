# CLAUDE.md

Guidance for Claude Code (and any AI assistant) working in this repository.

## What this is

**Stylewright** — a Manifest V3 browser extension (Chrome/Brave) for writing
**per-site CSS overrides**. The user opens a side panel, the editor pre-loads
the CSS last saved for that site, and the CSS is injected **only** when the user
clicks **Apply**. Nothing is applied automatically and nothing leaves the
device.

## Non-negotiable invariants

Do not break these without a deliberate, recorded decision:

1. **No network. Ever.** The extension makes zero API calls. No `fetch`,
   `XMLHttpRequest`, `WebSocket`, `sendBeacon`, analytics, or telemetry. A
   production CSP (`connect-src 'none'`) enforces this — keep it.
2. **All data stays local.** Persistence is `chrome.storage.local` only. Never
   add `storage.sync` or any remote backend. Export/import is the only data
   movement, and it is user-initiated, on-device file I/O.
3. **Never auto-apply without explicit per-site opt-in.** Manual Apply is the
   default and injects only on an explicit click. A site auto-applies on load
   *only* after the user turns on its per-site auto-apply toggle, which requires
   a persistent per-origin host permission.
   Auto-apply is gated by `shouldAutoApply` (entry `enabled` + `autoApply` +
   global kill switch), so Disable and the kill switch always stop it.
4. **Storage is the source of truth.** The injected `<style>` element is derived
   state. Never read application state back out of the page DOM.
5. **No `innerHTML`.** Render with `textContent`, `replaceChildren`, or the
   CodeMirror document API. Treat stored CSS as untrusted by default.
6. **Minimal permissions.** `activeTab` + `scripting` + `storage` (+ `sidePanel`,
   `unlimitedStorage`). No `tabs` and no blanket `host_permissions` — so no
   broad-access install warning. The panel is **invocation-scoped**: clicking the
   toolbar icon grants `activeTab` for that tab, which is how the panel reads the
   URL and injects. Tabs the user hasn't invoked show a "click the icon" prompt,
   not a styleable editor.
   Auto-apply still requests a specific persistent origin on demand via
   `chrome.permissions.request`.

## Architecture (one paragraph)

The **side panel** (`entrypoints/sidepanel/`) is a thin view: it resolves the
active tab of *its own window*, sends typed messages, and renders the returned
context. The **background service worker** (`entrypoints/background.ts`) owns
storage, permissions, and injection; it is stateless between events (MV3 evicts
idle workers — always re-read from storage). Injection runs a self-contained
function (`src/lib/inject.ts`) via `chrome.scripting.executeScript` that manages
a single `<style id="stylewright-injected-style">` element.

## Where things live

| Path | Responsibility |
| --- | --- |
| `entrypoints/background.ts` | Message router, injection, permissions, kill switch, export/import |
| `entrypoints/sidepanel/` | The editor UI (HTML/CSS/TS) |
| `src/lib/match.ts` | Hostname normalization + match resolution (pure) |
| `src/lib/storage.ts` | Storage schema, migrations, CRUD (pure helpers + chrome wrappers) |
| `src/lib/inject.ts` | The functions injected into pages (must be self-contained) |
| `src/lib/messages.ts` | Typed panel ⇄ worker message contract |
| `src/lib/__tests__/` | Vitest unit tests |
| `tests/e2e/` | Playwright end-to-end tests (load the built extension) |
| `scripts/generate-icons.mjs` | Code-generates the brand icons (no binary blobs) |

## Commands

```bash
npm run dev        # Chrome/Brave with HMR
npm run build      # production build → .output/chrome-mv3
npm run zip        # package for the Chrome Web Store
npm run icons      # regenerate brand icons
npm run check      # Biome lint + format check
npm run format     # auto-format
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests
npm run test:e2e   # Playwright e2e (build first)
```

Before committing: `npm run check && npm run typecheck && npm test`.

## Conventions

- TypeScript strict; no `any` without a clear reason.
- Keep branching logic in `src/lib` (pure, unit-tested), not in the UI.
- Functions in `inject.ts` are serialized into the page — no imports, no closure
  over module scope. Repeat literals (like the element id) inside them.
- Conventional Commits. Add a changeset (`npx changeset`) for user-facing
  changes. Commits in this repo are co-authored with Claude.
- Single brand: name **Stylewright**, accent indigo `#4f46e5`, the rounded
  brace mark. Keep naming and wording consistent across manifest, README, UI,
  and store listing.

## Gotchas

- The side panel is **global** (follows the user across tabs). Always re-key to
  the focused tab and act on an explicit `tabId` resolved from the panel's own
  window — never assume the active tab is unchanged.
- A hard navigation drops the injected `<style>` (expected in manual-only v1).
  Gate the Disable button on `entry.enabled` (intent), not the live probe.
- The `applied` probe via `executeScript` is best-effort; a failure means "no
  access", not "absent".
