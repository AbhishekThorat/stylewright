import { applyStyleInPage, isStylePresentInPage, removeStyleInPage } from '@/src/lib/inject';
import { hostKeyFromUrl, isInjectableUrl } from '@/src/lib/match';
import type { Request, Result, ResultMap, TabContext } from '@/src/lib/messages';
import {
  deleteEntry,
  exportBundle,
  getEntryForUrl,
  getMeta,
  importBundle,
  saveEntryForUrl,
  setEntryEnabled,
  setGloballyDisabled,
} from '@/src/lib/storage';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel (the editor surface).
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[css-overrides] setPanelBehavior failed', err));

  chrome.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
    handle(message)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ ok: false, error: errorMessage(err) }));
    return true; // keep the message channel open for the async response
  });
});

/** Marker prefix the panel detects to trigger a per-origin permission prompt. */
const NEEDS_PERMISSION = 'NEEDS_PERMISSION:';

async function handle(message: Request): Promise<Result<unknown>> {
  switch (message.type) {
    case 'getContext':
      return ok(await buildContext(message.tabId));

    case 'apply':
      return apply(message.tabId, message.css);

    case 'disable':
      return disable(message.tabId);

    case 'clearSite':
      return clearSite(message.tabId);

    case 'setGloballyDisabled': {
      await setGloballyDisabled(message.disabled);
      // Reflect the kill switch on the tab the user is looking at. Other tabs
      // have no auto-apply, so they self-clear on their next reload.
      const tab = message.tabId != null ? await getTab(message.tabId) : await getActiveTab();
      if (tab?.id != null && isInjectableUrl(tab.url)) {
        if (message.disabled) {
          await tryExecute(tab.id, removeStyleInPage);
        } else {
          const entry = tab.url ? await getEntryForUrl(tab.url) : null;
          if (entry?.enabled) await tryExecute(tab.id, applyStyleInPage, [entry.css]);
        }
      }
      return ok(await buildContext(message.tabId));
    }

    case 'export':
      return ok(await exportBundle());

    case 'import': {
      const count = await importBundle(message.json);
      return ok({ count, context: await buildContext(message.tabId) });
    }

    default:
      return { ok: false, error: 'Unknown request.' };
  }
}

async function apply(tabId: number, css: string): Promise<Result<TabContext>> {
  const tab = await getTab(tabId);
  if (!tab?.id || !isInjectableUrl(tab.url)) {
    return { ok: false, error: 'This page cannot be styled.' };
  }

  // Inject first; only persist if the injection actually lands.
  const injected = await execute(tab.id, applyStyleInPage, [css]);
  if (!injected.ok) {
    return await needsPermissionOrError(injected.error, tab.url ?? '');
  }

  await saveEntryForUrl(tab.url ?? '', css, true);
  return ok(await buildContext(tabId));
}

async function disable(tabId: number): Promise<Result<TabContext>> {
  const tab = await getTab(tabId);
  const entry = tab?.url ? await getEntryForUrl(tab.url) : null;

  // Keep the saved CSS; just stop applying it. Safe no-op if nothing is live.
  if (entry) await setEntryEnabled(entry.id, false);
  if (tab?.id != null && isInjectableUrl(tab.url)) {
    await tryExecute(tab.id, removeStyleInPage);
  }
  return ok(await buildContext(tabId));
}

async function clearSite(tabId: number): Promise<Result<TabContext>> {
  const tab = await getTab(tabId);
  const entry = tab?.url ? await getEntryForUrl(tab.url) : null;
  if (entry) await deleteEntry(entry.id);
  if (tab?.id != null && isInjectableUrl(tab.url)) {
    await tryExecute(tab.id, removeStyleInPage);
  }
  return ok(await buildContext(tabId));
}

// ---------------------------------------------------------------------------
// Context + injection helpers
// ---------------------------------------------------------------------------

async function buildContext(tabId: number | null): Promise<TabContext> {
  const tab = tabId != null ? await getTab(tabId) : await getActiveTab();
  const url = tab?.url ?? null;
  const injectable = isInjectableUrl(url);
  const meta = await getMeta();
  const entry = injectable && url ? await getEntryForUrl(url) : null;

  let applied = false;
  if (injectable && tab?.id != null) {
    const probe = await execute(tab.id, isStylePresentInPage);
    // A failed probe means "no access right now", not "definitely absent" — so
    // we only treat an explicit `true` as applied and never assert otherwise.
    applied = probe.ok && probe.result === true;
  }

  return {
    tabId: tab?.id ?? null,
    url,
    host: injectable && url ? hostKeyFromUrl(url) : null,
    injectable,
    entry,
    applied,
    globallyDisabled: meta.globallyDisabled,
  };
}

async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return undefined;
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

type ExecuteResult<R> = { ok: true; result: R | undefined } | { ok: false; error: string };

/** Run a self-contained function in the page; surface failure instead of throwing. */
async function execute<Args extends unknown[], R>(
  tabId: number,
  func: (...args: Args) => R,
  args?: Args,
): Promise<ExecuteResult<R>> {
  try {
    const [frame] = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args: args ?? ([] as unknown as Args),
    });
    return { ok: true, result: frame?.result as R | undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Fire-and-forget execute used when failure is non-fatal (e.g. cleanup). */
async function tryExecute<Args extends unknown[], R>(
  tabId: number,
  func: (...args: Args) => R,
  args?: Args,
): Promise<void> {
  await execute(tabId, func, args);
}

/**
 * Decide whether an injection failure is a missing-permission case (worth
 * prompting the user for this one origin) or a genuine error. We branch on the
 * actual grant via `permissions.contains` rather than parsing the (localized,
 * changeable) error text.
 */
async function needsPermissionOrError(error: string, url: string): Promise<Result<TabContext>> {
  const pattern = originPattern(url);
  // File access is a separate, non-promptable browser setting — don't offer it.
  if (pattern?.startsWith('http')) {
    const granted = await chrome.permissions.contains({ origins: [pattern] }).catch(() => true);
    if (!granted) return { ok: false, error: `${NEEDS_PERMISSION}${pattern}` };
  }
  return { ok: false, error };
}

function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Re-export so the panel can type the worker's return shape without importing it.
export type { ResultMap };
