import { send } from '@/src/lib/messages';
import type { TabContext } from '@/src/lib/messages';
import { css as cssLang } from '@codemirror/lang-css';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, placeholder } from '@codemirror/view';
import { basicSetup } from 'codemirror';

const NEEDS_PERMISSION = 'NEEDS_PERMISSION:';
const PLACEHOLDER =
  'Write CSS for this site, then click Apply…\n\nbody { filter: invert(1) hue-rotate(180deg); }';

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const el = {
  host: must<HTMLElement>('#host'),
  banner: must<HTMLDivElement>('#banner'),
  overlay: must<HTMLDivElement>('#overlay'),
  overlayText: must<HTMLParagraphElement>('#overlayText'),
  status: must<HTMLSpanElement>('#status'),
  clearBtn: must<HTMLButtonElement>('#clearBtn'),
  disableBtn: must<HTMLButtonElement>('#disableBtn'),
  applyBtn: must<HTMLButtonElement>('#applyBtn'),
  menuBtn: must<HTMLButtonElement>('#menuBtn'),
  menu: must<HTMLDivElement>('#menu'),
  killSwitch: must<HTMLInputElement>('#killSwitch'),
  clearSiteBtn: must<HTMLButtonElement>('#clearSiteBtn'),
  exportBtn: must<HTMLButtonElement>('#exportBtn'),
  importBtn: must<HTMLButtonElement>('#importBtn'),
  importFile: must<HTMLInputElement>('#importFile'),
};

// ---------------------------------------------------------------------------
// Editor (CodeMirror)
// ---------------------------------------------------------------------------
const themeCompartment = new Compartment();
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

const editor = new EditorView({
  parent: must<HTMLDivElement>('#editor'),
  state: EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      cssLang(),
      EditorView.lineWrapping,
      placeholder(PLACEHOLDER),
      themeCompartment.of(prefersDark.matches ? [oneDark] : []),
    ],
  }),
});
prefersDark.addEventListener('change', (e) => {
  editor.dispatch({ effects: themeCompartment.reconfigure(e.matches ? [oneDark] : []) });
});

function getEditorText(): string {
  return editor.state.doc.toString();
}

function setEditorText(text: string): void {
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
}

// ---------------------------------------------------------------------------
// State: in-memory drafts so switching tabs never loses unsaved work.
// (Drafts are never persisted; storage only changes on Apply.)
// ---------------------------------------------------------------------------
const drafts = new Map<string, string>();
let boundHost: string | null = null;
let current: TabContext | null = null;

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render(ctx: TabContext): void {
  const host = ctx.host;

  // Stash the buffer for the host we're leaving, then load the new one.
  if (boundHost !== host) {
    if (boundHost) drafts.set(boundHost, getEditorText());
    const saved = drafts.get(host ?? '') ?? ctx.entry?.css ?? '';
    setEditorText(saved);
    boundHost = host;
  }
  current = ctx;

  // Header
  el.host.textContent = host ?? 'No site';
  el.host.classList.toggle('active', ctx.applied);
  el.host.title = ctx.url ?? '';

  // Kill-switch banner
  el.killSwitch.checked = ctx.globallyDisabled;
  if (ctx.globallyDisabled) {
    showBanner('All overrides are turned off.', 'Turn on', () =>
      run({ type: 'setGloballyDisabled', disabled: false, tabId: ctx.tabId }, 'Overrides on'),
    );
  } else {
    hideBanner();
  }

  // Editability
  const editable = ctx.injectable && !ctx.globallyDisabled;
  el.overlay.hidden = ctx.injectable;
  el.overlayText.textContent = ctx.injectable
    ? ''
    : 'This page can’t be styled. Open a regular website to add overrides.';

  // Button states. Disable gates on intent (entry is enabled), NOT on the live
  // `applied` probe — after a reload the <style> is gone but the entry is still
  // enabled, and the user must still be able to turn it off.
  el.applyBtn.disabled = !editable;
  el.clearBtn.disabled = !editable;
  el.disableBtn.disabled = !ctx.injectable || !ctx.entry?.enabled;
  el.clearSiteBtn.disabled = !ctx.entry;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** The active tab of THIS panel's window — not whatever window last had focus. */
async function resolveTabId(): Promise<number | null> {
  try {
    const win = await chrome.windows.getCurrent();
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    return tab?.id ?? null;
  } catch {
    return null;
  }
}

// Latest-wins guard: tab/focus events can fire overlapping refreshes whose
// responses resolve out of order; only the newest result is allowed to render.
let refreshSeq = 0;
async function refresh(): Promise<void> {
  const seq = ++refreshSeq;
  const tabId = await resolveTabId();
  const res = await send({ type: 'getContext', tabId });
  if (seq !== refreshSeq) return; // superseded by a newer refresh
  if (res.ok) render(res.data);
}

async function onApply(): Promise<void> {
  const tabId = current?.tabId;
  if (tabId == null) {
    setStatus('This page cannot be styled.', 'error');
    return;
  }
  const css = getEditorText();
  setStatus('Applying…');
  let res = await send({ type: 'apply', tabId, css });

  // activeTab may not cover this tab (global side panel). Ask for the one
  // origin and retry — this prompt names a single site, not "all websites".
  if (!res.ok && res.error.startsWith(NEEDS_PERMISSION)) {
    const origin = res.error.slice(NEEDS_PERMISSION.length);
    const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!granted) {
      setStatus('Permission needed to apply here.', 'error');
      return;
    }
    res = await send({ type: 'apply', tabId, css });
  }

  if (!res.ok) {
    setStatus(res.error, 'error');
    return;
  }
  if (boundHost) drafts.delete(boundHost);
  boundHost = null; // force reload from the freshly saved entry
  render(res.data);
  setStatus('Applied.', 'success');
}

function onClear(): void {
  setEditorText('');
  editor.focus();
  setStatus('Editor cleared. Click Apply to save.');
}

async function onDisable(): Promise<void> {
  const tabId = current?.tabId;
  if (tabId == null) return;
  await run({ type: 'disable', tabId }, 'Disabled. Your CSS is kept.');
}

async function onClearSite(): Promise<void> {
  closeMenu();
  const tabId = current?.tabId;
  if (tabId == null) return;
  // Name the exact site we'll act on — the tab the panel is currently showing.
  const host = current?.host ?? 'this site';
  if (!confirm(`Delete all saved styles for ${host}? This cannot be undone.`)) return;
  drafts.delete(boundHost ?? '');
  boundHost = null;
  await run({ type: 'clearSite', tabId }, 'Saved styles deleted.');
}

async function onKillSwitch(): Promise<void> {
  await run({
    type: 'setGloballyDisabled',
    disabled: el.killSwitch.checked,
    tabId: current?.tabId ?? null,
  });
}

/** Send a request, render the returned context, and report status. */
async function run(req: Parameters<typeof send>[0], successMsg?: string): Promise<void> {
  const res = await send(req);
  if (!res.ok) {
    setStatus(res.error, 'error');
    return;
  }
  if ('injectable' in res.data) {
    boundHost = null; // re-sync editor with stored state
    render(res.data as TabContext);
  } else {
    await refresh();
  }
  if (successMsg) setStatus(successMsg, 'success');
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------
async function onExport(): Promise<void> {
  closeMenu();
  const res = await send({ type: 'export' });
  if (!res.ok) {
    setStatus(res.error, 'error');
    return;
  }
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `css-overrides-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Exported.', 'success');
}

function onImportClick(): void {
  closeMenu();
  el.importFile.click();
}

async function onImportFile(): Promise<void> {
  const file = el.importFile.files?.[0];
  el.importFile.value = '';
  if (!file) return;
  if (!confirm('Importing replaces all current overrides. Continue?')) return;

  const json = await file.text();
  const res = await send({ type: 'import', json, tabId: current?.tabId ?? null });
  if (!res.ok) {
    setStatus(res.error, 'error');
    return;
  }
  drafts.clear();
  boundHost = null;
  render(res.data.context);
  setStatus(`Imported ${res.data.count} site(s).`, 'success');
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
let statusTimer: ReturnType<typeof setTimeout> | undefined;
function setStatus(text: string, kind: '' | 'error' | 'success' = ''): void {
  el.status.textContent = text;
  el.status.className = `status${kind ? ` ${kind}` : ''}`;
  clearTimeout(statusTimer);
  if (kind === 'success' || (kind === '' && text)) {
    statusTimer = setTimeout(() => {
      el.status.textContent = '';
      el.status.className = 'status';
    }, 2600);
  }
}

let bannerAction: (() => void) | null = null;
function showBanner(text: string, actionLabel: string, action: () => void): void {
  el.banner.replaceChildren();
  const span = document.createElement('span');
  span.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = actionLabel;
  bannerAction = action;
  btn.addEventListener('click', () => bannerAction?.());
  el.banner.append(span, btn);
  el.banner.hidden = false;
}
function hideBanner(): void {
  el.banner.hidden = true;
  bannerAction = null;
}

function toggleMenu(): void {
  el.menu.hidden = !el.menu.hidden;
}
function closeMenu(): void {
  el.menu.hidden = true;
}

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing element: ${selector}`);
  return node;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
el.applyBtn.addEventListener('click', onApply);
el.clearBtn.addEventListener('click', onClear);
el.disableBtn.addEventListener('click', onDisable);
el.menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMenu();
});
el.killSwitch.addEventListener('change', onKillSwitch);
el.clearSiteBtn.addEventListener('click', onClearSite);
el.exportBtn.addEventListener('click', onExport);
el.importBtn.addEventListener('click', onImportClick);
el.importFile.addEventListener('change', onImportFile);

// Close the menu when clicking elsewhere.
document.addEventListener('click', (e) => {
  if (!el.menu.hidden && !el.menu.contains(e.target as Node)) closeMenu();
});

// Cmd/Ctrl+Enter applies.
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!el.applyBtn.disabled) onApply();
  }
});

// The side panel is global: re-key to whichever tab is focused.
chrome.tabs.onActivated.addListener(() => void refresh());
chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === 'complete' || changeInfo.url)) void refresh();
});
chrome.windows.onFocusChanged.addListener(() => void refresh());

void refresh();
