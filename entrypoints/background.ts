import { applyStyleInPage, isStylePresentInPage, removeStyleInPage } from '@/src/lib/inject';
import { isInjectableUrl } from '@/src/lib/match';
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
      return ok(await buildContext());

    case 'apply':
      return apply(message.css);

    case 'disable':
      return disable();

    case 'clearSite':
      return clearSite();

    case 'setGloballyDisabled': {
      await setGloballyDisabled(message.disabled);
      // Reflect the kill switch immediately on the live page.
      const tab = await getActiveTab();
      if (tab?.id != null && isInjectableUrl(tab.url)) {
        if (message.disabled) {
          await tryExecute(tab.id, removeStyleInPage);
        } else {
          const entry = tab.url ? await getEntryForUrl(tab.url) : null;
          if (entry?.enabled) await tryExecute(tab.id, applyStyleInPage, [entry.css]);
        }
      }
      return ok(await buildContext());
    }

    case 'export':
      return ok(await exportBundle());

    case 'import': {
      const count = await importBundle(message.json);
      return ok({ count, context: await buildContext() });
    }

    default:
      return { ok: false, error: 'Unknown request.' };
  }
}

async function apply(css: string): Promise<Result<TabContext>> {
  const tab = await getActiveTab();
  if (!tab?.id || !isInjectableUrl(tab.url)) {
    return { ok: false, error: 'This page cannot be styled.' };
  }

  // Inject first; only persist if the injection actually lands.
  const injected = await execute(tab.id, applyStyleInPage, [css]);
  if (!injected.ok) {
    return needsPermissionOrError(injected.error, tab.url ?? '');
  }

  await saveEntryForUrl(tab.url ?? '', css, true);
  return ok(await buildContext());
}

async function disable(): Promise<Result<TabContext>> {
  const tab = await getActiveTab();
  const entry = tab?.url ? await getEntryForUrl(tab.url) : null;

  // Keep the saved CSS; just stop applying it.
  if (entry) await setEntryEnabled(entry.id, false);
  if (tab?.id != null && isInjectableUrl(tab.url)) {
    await tryExecute(tab.id, removeStyleInPage);
  }
  return ok(await buildContext());
}

async function clearSite(): Promise<Result<TabContext>> {
  const tab = await getActiveTab();
  const entry = tab?.url ? await getEntryForUrl(tab.url) : null;
  if (entry) await deleteEntry(entry.id);
  if (tab?.id != null && isInjectableUrl(tab.url)) {
    await tryExecute(tab.id, removeStyleInPage);
  }
  return ok(await buildContext());
}

// ---------------------------------------------------------------------------
// Context + injection helpers
// ---------------------------------------------------------------------------

async function buildContext(): Promise<TabContext> {
  const tab = await getActiveTab();
  const url = tab?.url ?? null;
  const injectable = isInjectableUrl(url);
  const meta = await getMeta();
  const entry = injectable && url ? await getEntryForUrl(url) : null;

  let applied = false;
  if (injectable && tab?.id != null) {
    const probe = await execute(tab.id, isStylePresentInPage);
    applied = probe.ok && probe.result === true;
  }

  return {
    tabId: tab?.id ?? null,
    url,
    host: injectable && entry ? entry.match.value : injectable ? hostLabel(url) : null,
    injectable,
    entry,
    applied,
    globallyDisabled: meta.globallyDisabled,
  };
}

function hostLabel(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
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

function needsPermissionOrError(error: string, url: string): Result<TabContext> {
  const pattern = originPattern(url);
  if (pattern && /cannot access|permission|host/i.test(error)) {
    return { ok: false, error: `${NEEDS_PERMISSION}${pattern}` };
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
