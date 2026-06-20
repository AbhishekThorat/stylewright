// Typed message contract between the side panel and the background worker.

import type { ExportBundle, StyleEntry } from './storage';

/** A snapshot of the focused tab and its override, sent back after every action. */
export interface TabContext {
  tabId: number | null;
  url: string | null;
  /** Normalized host key, or null when the page cannot be styled. */
  host: string | null;
  injectable: boolean;
  /**
   * Live tab, but Chrome won't reveal its URL yet (no `activeTab` grant) — the
   * user must click the toolbar icon. Distinct from `injectable: false` on a
   * known-internal page that genuinely can't be styled.
   */
  needsActivation: boolean;
  /** The saved override for this site, if any. */
  entry: StyleEntry | null;
  /** Whether the override is currently injected in the live page. */
  applied: boolean;
  globallyDisabled: boolean;
}

// Every page-targeting request carries the exact tabId the panel resolved from
// its OWN window, so the worker never acts on a different tab than the one the
// user is looking at (the side panel is global; the active tab can drift).
export type Request =
  | { type: 'getContext'; tabId: number | null }
  | { type: 'apply'; tabId: number; css: string }
  | { type: 'setAutoApply'; tabId: number; autoApply: boolean }
  | { type: 'disable'; tabId: number }
  | { type: 'clearSite'; tabId: number }
  | { type: 'setGloballyDisabled'; disabled: boolean; tabId: number | null }
  | { type: 'export' }
  | { type: 'import'; json: string; tabId: number | null };

export type RequestType = Request['type'];

/** Worker → panel push: re-read context after the toolbar-click activeTab grant. */
export type Notification = { type: 'panelRefresh' };

/** Narrowing guard for the untyped `chrome.runtime.onMessage` payload. */
export function isNotification(msg: unknown): msg is Notification {
  return (
    typeof msg === 'object' && msg !== null && (msg as { type?: unknown }).type === 'panelRefresh'
  );
}

export interface ResultMap {
  getContext: TabContext;
  apply: TabContext;
  setAutoApply: TabContext;
  disable: TabContext;
  clearSite: TabContext;
  setGloballyDisabled: TabContext;
  export: ExportBundle;
  import: { count: number; context: TabContext };
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Typed wrapper around `chrome.runtime.sendMessage` for the panel side. */
export async function send<T extends Request>(req: T): Promise<Result<ResultMap[T['type']]>> {
  return (await chrome.runtime.sendMessage(req)) as Result<ResultMap[T['type']]>;
}
