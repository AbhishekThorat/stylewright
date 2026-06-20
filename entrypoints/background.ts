import { applyStyleInPage, isStylePresentInPage, removeStyleInPage } from '@/src/lib/inject';
import { hostKeyFromUrl, isInjectableUrl, matchesUrl } from '@/src/lib/match';
import type { Request, Result, ResultMap, TabContext } from '@/src/lib/messages';
import {
  deleteEntry,
  exportBundle,
  getAllEntries,
  getEntryForUrl,
  getMeta,
  importBundle,
  saveEntryForUrl,
  setEntryAutoApply,
  setEntryEnabled,
  setGloballyDisabled,
} from '@/src/lib/storage';

export default defineBackground(() => {
  // Handle the click ourselves instead of `openPanelOnActionClick`: that helper
  // consumes the click and never fires `onClicked`, so the `activeTab` grant —
  // what lets the panel read the URL and inject — never happens. This both grants
  // activeTab for the invoked tab and opens the panel.
  chrome.action.onClicked.addListener((tab) => {
    if (tab.windowId != null) {
      chrome.sidePanel
        .open({ windowId: tab.windowId })
        .catch((err) => console.error('[stylewright] sidePanel.open failed', err));
    }
    // The click granted activeTab but fires no tab/focus event; nudge an
    // already-open panel to re-read. No panel open yet → no receiver → ignore.
    chrome.runtime.sendMessage({ type: 'panelRefresh' }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
    handle(message)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ ok: false, error: errorMessage(err) }));
    return true; // keep the message channel open for the async response
  });

  // Auto-apply registrations are derived state: rebuild from storage + granted
  // permissions on install/start so they survive upgrades, imports, and revokes.
  chrome.runtime.onInstalled.addListener(() => void reconcileAutoApply());
  chrome.runtime.onStartup.addListener(() => void reconcileAutoApply());
});

/** Marker prefix the panel detects to trigger a per-origin permission prompt. */
const NEEDS_PERMISSION = 'NEEDS_PERMISSION:';

async function handle(message: Request): Promise<Result<unknown>> {
  switch (message.type) {
    case 'getContext':
      return ok(await buildContext(message.tabId));

    case 'apply':
      return apply(message.tabId, message.css);

    case 'setAutoApply':
      return setAutoApply(message.tabId, message.autoApply);

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
      // Imported entries may carry auto-apply; rebuild registrations to match.
      await reconcileAutoApply();
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

/**
 * Turn opt-in auto-apply on/off for the current site. Enabling needs a persistent
 * host permission (load-time injection has no user gesture for `activeTab`) and
 * registers a `document_start` script; disabling unregisters and revokes the
 * origin grant once no other auto-apply entry needs it.
 */
async function setAutoApply(tabId: number, autoApply: boolean): Promise<Result<TabContext>> {
  const tab = await getTab(tabId);
  if (!tab?.id || !isInjectableUrl(tab.url)) {
    return { ok: false, error: 'This page cannot be styled.' };
  }
  const url = tab.url ?? '';
  const entry = await getEntryForUrl(url);
  if (!entry) {
    return { ok: false, error: 'Apply your CSS first, then turn on auto-apply.' };
  }
  const pattern = originPattern(url);
  if (!pattern?.startsWith('http')) {
    // file: origins can't be granted by prompt, so they can't auto-apply.
    return { ok: false, error: 'Auto-apply is only available on http/https sites.' };
  }

  if (autoApply) {
    const granted = await chrome.permissions.contains({ origins: [pattern] }).catch(() => false);
    if (!granted) return { ok: false, error: `${NEEDS_PERMISSION}${pattern}` };

    await setEntryAutoApply(entry.id, true);
    await registerAutoApply(pattern);
    // Apply now too, so the toggle takes effect without a reload.
    if (entry.enabled) await tryExecute(tab.id, applyStyleInPage, [entry.css]);
  } else {
    await setEntryAutoApply(entry.id, false);
    await unregisterAutoApply(pattern);
    await maybeRevokeOrigin(pattern);
    // Leave any live <style> as-is — the override is still enabled (manual).
  }
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
  // A live tab whose URL we can't see means "not yet activated" (no activeTab
  // grant), not "unstyleable" — the panel prompts the user to click the icon.
  const needsActivation = tab?.id != null && url == null;
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
    needsActivation,
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
 * Is an injection failure a missing-permission case (prompt for this one origin)
 * or a genuine error? Branch on the actual grant, not the localized error text.
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

// ---------------------------------------------------------------------------
// Auto-apply: per-origin content-script registration
// ---------------------------------------------------------------------------

// WXT builds the runtime-registered content script to this path.
const AUTO_APPLY_JS = 'content-scripts/auto-apply.js';
const AUTO_APPLY_ID_PREFIX = 'aa-';

/** Deterministic, charset-safe content-script id for an origin pattern. */
function scriptIdForPattern(pattern: string): string {
  return AUTO_APPLY_ID_PREFIX + pattern.replace(/[^a-zA-Z0-9]/g, '_');
}

/** Strip the trailing glob so we can match-test entries: `…/*` → `…/`. */
function representativeUrl(pattern: string): string {
  return pattern.replace(/\*$/, '');
}

/** Register (or refresh) the document_start auto-apply script for an origin. */
async function registerAutoApply(pattern: string): Promise<void> {
  const script: chrome.scripting.RegisteredContentScript = {
    id: scriptIdForPattern(pattern),
    matches: [pattern],
    js: [AUTO_APPLY_JS],
    runAt: 'document_start',
    allFrames: false,
    persistAcrossSessions: true,
  };
  const existing = await chrome.scripting
    .getRegisteredContentScripts({ ids: [script.id] })
    .catch(() => [] as chrome.scripting.RegisteredContentScript[]);
  if (existing.length > 0) {
    await chrome.scripting.updateContentScripts([script]);
  } else {
    await chrome.scripting.registerContentScripts([script]);
  }
}

async function unregisterAutoApply(pattern: string): Promise<void> {
  await chrome.scripting
    .unregisterContentScripts({ ids: [scriptIdForPattern(pattern)] })
    .catch(() => {});
}

/** Drop the origin grant once no remaining auto-apply entry needs it. */
async function maybeRevokeOrigin(pattern: string): Promise<void> {
  const url = representativeUrl(pattern);
  const entries = await getAllEntries();
  const stillNeeded = entries.some((e) => e.autoApply && matchesUrl(e.match, url));
  if (!stillNeeded) {
    await chrome.permissions.remove({ origins: [pattern] }).catch(() => {});
  }
}

/**
 * Rebuild auto-apply registrations from storage + granted permissions: register
 * a script for every granted origin that a still-auto-apply entry matches, and
 * unregister any of ours that no longer should run. Idempotent.
 */
async function reconcileAutoApply(): Promise<void> {
  const autoEntries = (await getAllEntries()).filter((e) => e.autoApply);
  const perms = await chrome.permissions.getAll().catch(() => ({ origins: [] as string[] }));
  const grantedOrigins = perms.origins ?? [];

  const desired = grantedOrigins.filter((pattern) =>
    autoEntries.some((e) => matchesUrl(e.match, representativeUrl(pattern))),
  );
  const desiredIds = new Set(desired.map(scriptIdForPattern));

  const registered = await chrome.scripting
    .getRegisteredContentScripts()
    .catch(() => [] as chrome.scripting.RegisteredContentScript[]);
  const staleIds = registered
    .filter((s) => s.id.startsWith(AUTO_APPLY_ID_PREFIX) && !desiredIds.has(s.id))
    .map((s) => s.id);
  if (staleIds.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: staleIds }).catch(() => {});
  }
  for (const pattern of desired) await registerAutoApply(pattern);
}

function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Re-export so the panel can type the worker's return shape without importing it.
export type { ResultMap };
