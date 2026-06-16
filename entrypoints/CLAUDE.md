# entrypoints — extension surfaces

WXT entrypoints. These run in real extension contexts with all the MV3
constraints; keep them thin and push logic into `src/lib`.

## `background.ts` — service worker

- **Stateless between events.** MV3 evicts idle workers. Never hold app state in
  worker memory — re-read from `chrome.storage` on every message.
- Owns: the message router, injection via `chrome.scripting.executeScript`,
  per-origin permission decisions, the global kill switch, and export/import.
- Acts on the **explicit `tabId`** from the request (`chrome.tabs.get`), not on
  `lastFocusedWindow` — the panel decides which tab is the target.
- The permission retry returns a `NEEDS_PERMISSION:<originPattern>` error; the
  panel raises the prompt (it has the user gesture) and retries.

## `sidepanel/` — the editor UI

- The side panel is **global** (one per window, persists across tab switches).
  Resolve the active tab from the panel's **own window**
  (`chrome.windows.getCurrent`), re-key on `tabs.onActivated` / `onUpdated` /
  `windows.onFocusChanged`, and always show the "Editing: `<host>`" header.
- In-memory `drafts` preserve unsaved buffers per host across tab switches;
  drafts are **never** persisted (storage only changes on Apply).
- Render with `textContent` / `replaceChildren` / CodeMirror — **never**
  `innerHTML`.
- `refresh()` is sequence-guarded (latest-wins) because tab/focus events can
  fire overlapping context fetches.
- Button contract: **Clear** empties the editor only; **Disable** stops applying
  but keeps the saved CSS (gated on `entry.enabled`); **Apply** injects + saves.
