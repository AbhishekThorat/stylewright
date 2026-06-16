/**
 * Typed message contract between the side panel and the background worker.
 *
 * The worker owns storage, permissions, and injection; the panel is a thin
 * view that sends requests and renders the returned context.
 */

import type { ExportBundle, StyleEntry } from './storage';

/** A snapshot of the focused tab and its override, sent back after every action. */
export interface TabContext {
  tabId: number | null;
  url: string | null;
  /** Normalized host key, or null when the page cannot be styled. */
  host: string | null;
  injectable: boolean;
  /** The saved override for this site, if any. */
  entry: StyleEntry | null;
  /** Whether the override is currently injected in the live page. */
  applied: boolean;
  globallyDisabled: boolean;
}

export type Request =
  | { type: 'getContext' }
  | { type: 'apply'; css: string }
  | { type: 'disable' }
  | { type: 'clearSite' }
  | { type: 'setGloballyDisabled'; disabled: boolean }
  | { type: 'export' }
  | { type: 'import'; json: string };

export type RequestType = Request['type'];

export interface ResultMap {
  getContext: TabContext;
  apply: TabContext;
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
