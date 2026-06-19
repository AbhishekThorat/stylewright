# ADR 0001: Core architecture for Stylewright

- **Status:** Accepted
- **Date:** 2026-06-16

## Context

Stylewright is a Manifest V3 extension for Chrome/Brave that lets users write
per-site CSS overrides. Styles are pre-loaded per hostname and applied only on
explicit user action — never automatically. This ADR records the foundational
decisions, several of which are one-way doors.

## Decisions

### 1. Editor surface: side panel (`chrome.sidePanel`)

A popup closes on blur, which is fatal for an editor workflow (type → click the
page to see the effect → tweak). The side panel stays open.

**Consequence:** the side panel is *global* — it follows the user across tabs.
The editor must track `tabs.onActivated` / `onUpdated`, re-key to the focused
tab's hostname, and always show an "Editing: `<host>`" header so the user knows
which site they're about to change.

### 2. Injection: content-managed `<style>` element, not `insertCSS`

We inject via `chrome.scripting.executeScript`, running a small function that
finds-or-creates `<style id="stylewright-injected-style">` on `document.documentElement` and
sets its `textContent`. Disable removes the element.

We reject `chrome.scripting.insertCSS` / `removeCSS` because `removeCSS`
requires an exact-byte match of the previously inserted CSS — a latent bug
factory for a live editor. A managed `<style>` gives unambiguous
apply/update/remove semantics and uses the `AUTHOR` cascade origin, which
behaves like a normal site stylesheet (predictable, no forced `!important`).

### 3. Storage schema keyed by `id`, with a `match` object

Storage is `Record<id, StyleEntry>` where:

```ts
interface StyleEntry {
  id: string;             // uuid — the real key
  match: {
    type: 'host' | 'domain' | 'url-prefix' | 'regex';
    value: string;
  };
  css: string;
  enabled: boolean;
  updatedAt: number;
  schemaVersion: number;
}
```

Keying by raw hostname would hard-code "exact host" as the only matching model
forever (a one-way door). The `match` object keeps domain-wide and
path-specific rules a non-breaking future addition. v1 only writes
`type: 'host'`; other types are schema-only seams.

**Normalization defaults:** strip a leading `www.`; keep the port only when
present (`localhost:3000` ≠ `localhost:8080`); exact host by default
(`mail.google.com` ≠ `google.com`).

### 4. Permissions: `activeTab` + `scripting` + `storage`

No blanket `host_permissions`. `activeTab` grants temporary access to the active
tab on user invocation — which exactly matches "apply only on click" and avoids
the install-killing "read all your data on all websites" warning.
`optional_host_permissions: ["*://*/*"]` is declared so specific origins can be
requested on demand (one site at a time) — needed for the future auto-apply seam.

### 5. Manual-only apply, with seams for opt-in auto-apply

v1 never applies automatically; the `enabled` flag, per-entry storage, and
optional per-origin permissions are designed so a future per-site "reapply on
load" toggle (using `registerContentScripts` at `document_start`) is additive,
not a rewrite.

### 6. Persistence: `chrome.storage.local` (+ `unlimitedStorage`), no `sync`

`storage.sync` has an 8 KB per-item limit — too small for a stylesheet.
`storage.local` is the source of truth. Multi-device is served by JSON
export/import (which doubles as backup), not `sync`.

### 7. Tooling

WXT (MV3 framework), TypeScript, CodeMirror 6, Biome (lint+format), Vitest
(unit), Playwright (e2e), GitHub Actions (CI), Changesets (release), MIT license.

## Security notes

- Self-authored CSS can exfiltrate via `url()` / `@import`; accepted while the
  only source is the user. **Must** be sanitized if URL-import/sharing is ever
  added.
- Panel renders with `textContent` / CodeMirror only — never `innerHTML`.
- A global kill switch and an always-reachable Disable button are the escape
  hatch from a self-inflicted `display:none` lockout.

## Implementation-review amendments

A post-implementation architecture review surfaced correctness issues in the
global-side-panel ÷ activeTab interaction, now resolved:

- **Explicit tab targeting.** Every page-acting request carries the `tabId` the
  panel resolves from *its own window* (`chrome.windows.getCurrent`), and the
  worker acts on exactly that tab. This removes the `lastFocusedWindow`
  ambiguity and the risk that destructive **Clear Site** deletes a different
  site than the one named in the confirm dialog.
- **Disable gates on intent, not live state.** The button is enabled when the
  entry's `enabled` flag is set, not when the `applied` probe sees a live
  `<style>`. After a hard reload (no auto-apply in v1) the style is gone but the
  entry is still enabled, and the user must remain able to turn it off.
- **`applied` is treated as best-effort.** A failed `executeScript` probe means
  "no access right now", not "absent"; only an explicit `true` marks applied.
- **Permission detection via `permissions.contains`.** The apply retry path
  branches on the actual origin grant rather than matching (localized) error
  text. `file:` origins are excluded since they can't be granted by prompt.
- **Latest-wins refresh.** Overlapping context refreshes from tab/focus events
  are sequence-guarded so a stale response can't overwrite a newer render.

## Deferred (P2)

Path/regex match UI, `MutationObserver` re-injection for hostile DOMs,
cross-origin iframe styling, cross-device sync, import-from-URL/sharing.
