/**
 * Storage layer. `chrome.storage.local` is the single source of truth; the
 * live injected <style> is derived state (see ADR 0001).
 *
 * The pure helpers (`selectEntryForUrl`, `migrate`, `parseImport`) carry the
 * branching logic and are unit-tested without a browser. The async wrappers are
 * thin shells over `chrome.storage.local`.
 */

import { type Match, defaultMatchForUrl, matchesUrl } from './match';

export const SCHEMA_VERSION = 2;

const ENTRIES_KEY = 'overrides';
const META_KEY = 'meta';

export interface StyleEntry {
  /** Opaque uuid — the real storage key. */
  id: string;
  match: Match;
  css: string;
  /** Master on/off (the Disable button). When false, nothing applies. */
  enabled: boolean;
  /**
   * Opt-in: re-apply this entry automatically on every page load (v2). Gated by
   * `enabled` and the global kill switch. Requires a persistent host permission
   * for the origin; defaults false so existing entries stay manual-only.
   */
  autoApply: boolean;
  updatedAt: number;
  schemaVersion: number;
}

export interface Meta {
  schemaVersion: number;
  /** Global kill switch — when true, nothing should be applied. */
  globallyDisabled: boolean;
}

export type EntryMap = Record<string, StyleEntry>;

export interface ExportBundle {
  app: 'css-overrides';
  schemaVersion: number;
  exportedAt: number;
  entries: StyleEntry[];
  meta: Meta;
}

const DEFAULT_META: Meta = { schemaVersion: SCHEMA_VERSION, globallyDisabled: false };

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Choose the entry that applies to a URL. Prefers a `host` match (the precise,
 * v1 default) over broader rules so a site-specific override wins over a
 * domain-wide one. Returns `null` when nothing matches.
 */
export function selectEntryForUrl(entries: StyleEntry[], url: string): StyleEntry | null {
  const matching = entries.filter((entry) => matchesUrl(entry.match, url));
  if (matching.length === 0) return null;

  const specificity: Record<Match['type'], number> = {
    host: 3,
    'url-prefix': 2,
    regex: 1,
    domain: 0,
  };
  matching.sort((a, b) => {
    const byType = specificity[b.match.type] - specificity[a.match.type];
    return byType !== 0 ? byType : b.updatedAt - a.updatedAt;
  });
  return matching[0] ?? null;
}

/**
 * Should this entry be injected automatically on page load? Pure gate shared by
 * the auto-apply content script and the worker: the entry must be enabled, opted
 * into auto-apply, and the global kill switch off.
 */
export function shouldAutoApply(entry: StyleEntry, meta: Meta): boolean {
  return entry.enabled && entry.autoApply && !meta.globallyDisabled;
}

/** Normalize raw storage into the current schema. Forward-compatible by design. */
export function migrate(rawEntries: unknown, rawMeta: unknown): { entries: EntryMap; meta: Meta } {
  const entries: EntryMap = {};
  if (rawEntries && typeof rawEntries === 'object') {
    for (const value of Object.values(rawEntries as Record<string, unknown>)) {
      const entry = coerceEntry(value);
      if (entry) entries[entry.id] = entry;
    }
  }
  const meta = coerceMeta(rawMeta);
  return { entries, meta };
}

/** Parse and validate a JSON string from import. Throws on malformed input. */
export function parseImport(json: string): { entries: EntryMap; meta: Meta } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('File does not contain an export bundle.');
  }
  const bundle = data as Partial<ExportBundle>;
  if (bundle.app !== 'css-overrides') {
    throw new Error('This file was not exported by CSS Overrides.');
  }
  return migrate(arrayToMap(bundle.entries), bundle.meta);
}

function arrayToMap(entries: StyleEntry[] | undefined): EntryMap {
  const map: EntryMap = {};
  for (const entry of entries ?? []) map[entry.id] = entry;
  return map;
}

function coerceEntry(value: unknown): StyleEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.css !== 'string') return null;
  const match = v.match as Match | undefined;
  if (!match || typeof match.type !== 'string' || typeof match.value !== 'string') return null;
  return {
    id: typeof v.id === 'string' ? v.id : crypto.randomUUID(),
    match,
    css: v.css,
    enabled: v.enabled !== false,
    // v1 entries have no `autoApply`; default false keeps them manual-only.
    autoApply: v.autoApply === true,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
    schemaVersion: SCHEMA_VERSION,
  };
}

function coerceMeta(value: unknown): Meta {
  if (!value || typeof value !== 'object') return { ...DEFAULT_META };
  const v = value as Record<string, unknown>;
  return {
    schemaVersion: SCHEMA_VERSION,
    globallyDisabled: v.globallyDisabled === true,
  };
}

// ---------------------------------------------------------------------------
// Async wrappers over chrome.storage.local
// ---------------------------------------------------------------------------

async function readRaw(): Promise<{ entries: EntryMap; meta: Meta }> {
  const stored = await chrome.storage.local.get([ENTRIES_KEY, META_KEY]);
  return migrate(stored[ENTRIES_KEY], stored[META_KEY]);
}

export async function getAllEntries(): Promise<StyleEntry[]> {
  const { entries } = await readRaw();
  return Object.values(entries);
}

export async function getEntryForUrl(url: string): Promise<StyleEntry | null> {
  const entries = await getAllEntries();
  return selectEntryForUrl(entries, url);
}

export async function getMeta(): Promise<Meta> {
  const { meta } = await readRaw();
  return meta;
}

/** Create or update the host-level override for a URL. Returns the saved entry. */
export async function saveEntryForUrl(
  url: string,
  css: string,
  enabled: boolean,
): Promise<StyleEntry> {
  const match = defaultMatchForUrl(url);
  if (!match) throw new Error('This page cannot be styled.');

  const { entries, meta } = await readRaw();
  const existing = Object.values(entries).find(
    (e) => e.match.type === 'host' && e.match.value === match.value,
  );

  const entry: StyleEntry = {
    id: existing?.id ?? crypto.randomUUID(),
    match,
    css,
    enabled,
    // Editing/re-applying CSS must not silently change the auto-apply intent.
    autoApply: existing?.autoApply ?? false,
    updatedAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
  };
  entries[entry.id] = entry;
  await writeRaw(entries, meta);
  return entry;
}

export async function setEntryEnabled(id: string, enabled: boolean): Promise<void> {
  const { entries, meta } = await readRaw();
  const entry = entries[id];
  if (!entry) return;
  entry.enabled = enabled;
  entry.updatedAt = Date.now();
  await writeRaw(entries, meta);
}

export async function setEntryAutoApply(id: string, autoApply: boolean): Promise<void> {
  const { entries, meta } = await readRaw();
  const entry = entries[id];
  if (!entry) return;
  entry.autoApply = autoApply;
  entry.updatedAt = Date.now();
  await writeRaw(entries, meta);
}

export async function deleteEntry(id: string): Promise<void> {
  const { entries, meta } = await readRaw();
  delete entries[id];
  await writeRaw(entries, meta);
}

export async function setGloballyDisabled(disabled: boolean): Promise<void> {
  const { entries, meta } = await readRaw();
  meta.globallyDisabled = disabled;
  await writeRaw(entries, meta);
}

export async function exportBundle(): Promise<ExportBundle> {
  const { entries, meta } = await readRaw();
  return {
    app: 'css-overrides',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    entries: Object.values(entries),
    meta,
  };
}

/** Replace all stored data with an imported bundle. */
export async function importBundle(json: string): Promise<number> {
  const { entries, meta } = parseImport(json);
  await writeRaw(entries, meta);
  return Object.keys(entries).length;
}

async function writeRaw(entries: EntryMap, meta: Meta): Promise<void> {
  await chrome.storage.local.set({ [ENTRIES_KEY]: entries, [META_KEY]: meta });
}
