# ADR 0002: Opt-in per-site auto-apply on page load

- **Status:** Accepted
- **Date:** 2026-06-17
- **Amends:** ADR 0001 §5 (manual-only apply), CLAUDE.md invariant #3.

## Context

v1 is manual-only: an override is injected only on an explicit **Apply** click,
and a hard navigation drops the injected `<style>`. ADR 0001 §4/§5 deliberately
left seams for a *future* opt-in auto-apply — the `enabled` flag,
`optional_host_permissions` for on-demand per-origin grants, and a planned
`registerContentScripts` at `document_start`. This ADR turns that seam on as an
**opt-in, per-site** feature. Manual apply remains the default; nothing
auto-applies unless the user explicitly turns it on for a given site.

## Decisions

### 1. Per-entry `autoApply` flag, gated by `enabled` + the kill switch

`StyleEntry` gains `autoApply: boolean` (default `false`). The pure gate
`shouldAutoApply(entry, meta) = entry.enabled && entry.autoApply &&
!meta.globallyDisabled` is shared by the worker and the content script, so the
global kill switch and per-site **Disable** suppress auto-apply for free, with no
registration churn. `enabled` stays the master on/off; `autoApply` is the
load-time intent layered on top.

`SCHEMA_VERSION` bumps 1 → 2; `coerceEntry` defaults missing `autoApply` to
`false`, so every existing v1 entry stays manual-only (safe, non-destructive
migration). `saveEntryForUrl` preserves the flag so editing/re-applying CSS never
silently changes the auto-apply intent.

### 2. Mechanism: runtime-registered `document_start` content script

Opting a site in registers a content script (via
`chrome.scripting.registerContentScripts`) scoped to that origin, running at
`document_start`. It reads storage, resolves the matching entry, and injects the
managed `<style>` if `shouldAutoApply` holds. WXT builds it with
`registration: 'runtime'` so it is **not** in the manifest — and crucially its
`matches: []` adds nothing to `host_permissions`.

**Rejected:** a `webNavigation`/`tabs.onUpdated` listener in the worker that
calls `executeScript`. The MV3 worker is evicted when idle and can't reliably
wake and inject before first paint, causing a flash of unstyled content. A
registered content script is the only way to guarantee `document_start` timing.

The injected `<style>` stays **derived** state; storage remains the single
source of truth (invariant #4). The content script never reads state back out of
the DOM.

### 3. Persistent per-origin host permission is required

Load-time injection has no user gesture, so `activeTab` cannot cover it.
Enabling auto-apply for a site therefore requests a persistent host permission
for that one origin (`chrome.permissions.request({ origins: ['https://site/*']
})`), raised from the panel's user gesture — exactly the existing
`NEEDS_PERMISSION` retry flow used by **Apply**. This stays within invariant #6
(specific origins, on demand, one site at a time) and reuses the already-declared
`optional_host_permissions`. Turning auto-apply off unregisters the script and
**revokes** the origin grant when no other auto-apply entry still needs it.

### 4. Registrations are derived state, reconciled from storage

Registered scripts use a deterministic id per origin and
`persistAcrossSessions: true`. `reconcileAutoApply()` rebuilds them from
(auto-apply entries × granted origins) on `onInstalled`, `onStartup`, and after
**import**, registering what should run and dropping anything stale (e.g. a grant
revoked from Chrome's settings). This keeps registrations consistent without
trusting them as a source of truth.

## Consequences

- A brief async storage read precedes injection at `document_start`; effectively
  flash-free in practice, but not synchronous. Acceptable — `chrome.storage`
  offers no synchronous read.
- Auto-apply is registered for the **exact** origin the user opts in from. The
  `www.`/non-`www.` variant of a host is a distinct origin and would need its own
  opt-in — consistent with how manual Apply already scopes its per-origin grant.
- The escape hatches still hold: the global kill switch and the always-reachable
  **Disable** button both stop auto-apply on the next load.

## Security notes

- No new network surface: the content script injects a local `<style>`; the
  production CSP (`connect-src 'none'`) is unchanged.
- No `innerHTML`; injection uses `textContent` (invariant #5).
- Stored CSS remains self-authored and is still treated as the only source; the
  `url()`/`@import` exfiltration note in ADR 0001 continues to apply and would
  need sanitization before any sharing/URL-import feature.
