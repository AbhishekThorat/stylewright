import { describe, expect, it } from 'vitest';
import type { Meta, StyleEntry } from '../storage';
import {
  SCHEMA_VERSION,
  migrate,
  parseImport,
  selectEntryForUrl,
  shouldAutoApply,
} from '../storage';

function entry(partial: Partial<StyleEntry> & Pick<StyleEntry, 'id' | 'match'>): StyleEntry {
  return {
    css: 'body{}',
    enabled: true,
    autoApply: false,
    updatedAt: 1,
    schemaVersion: SCHEMA_VERSION,
    ...partial,
  };
}

describe('selectEntryForUrl', () => {
  it('returns null when nothing matches', () => {
    const e = entry({ id: '1', match: { type: 'host', value: 'other.com' } });
    expect(selectEntryForUrl([e], 'https://example.com')).toBeNull();
  });

  it('prefers a host match over a broader domain match', () => {
    const host = entry({ id: 'h', match: { type: 'host', value: 'example.com' } });
    const domain = entry({ id: 'd', match: { type: 'domain', value: 'example.com' } });
    const picked = selectEntryForUrl([domain, host], 'https://example.com');
    expect(picked?.id).toBe('h');
  });

  it('breaks ties by most recently updated', () => {
    const a = entry({ id: 'a', match: { type: 'host', value: 'example.com' }, updatedAt: 10 });
    const b = entry({ id: 'b', match: { type: 'host', value: 'example.com' }, updatedAt: 20 });
    expect(selectEntryForUrl([a, b], 'https://example.com')?.id).toBe('b');
  });
});

describe('migrate', () => {
  it('keeps valid entries and drops malformed ones', () => {
    const raw = {
      good: { id: 'good', match: { type: 'host', value: 'a.com' }, css: 'a{}' },
      bad: { id: 'bad', css: 123 },
      noMatch: { id: 'noMatch', css: 'x{}' },
    };
    const { entries } = migrate(raw, undefined);
    expect(Object.keys(entries)).toEqual(['good']);
    expect(entries.good?.enabled).toBe(true);
    expect(entries.good?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('defaults meta and honors a true kill switch', () => {
    expect(migrate(undefined, undefined).meta.globallyDisabled).toBe(false);
    expect(migrate(undefined, { globallyDisabled: true }).meta.globallyDisabled).toBe(true);
  });

  it('defaults autoApply to false for legacy (v1) entries', () => {
    const raw = { e: { id: 'e', match: { type: 'host', value: 'a.com' }, css: 'a{}' } };
    expect(migrate(raw, undefined).entries.e?.autoApply).toBe(false);
  });

  it('preserves an explicit autoApply flag', () => {
    const raw = {
      e: { id: 'e', match: { type: 'host', value: 'a.com' }, css: 'a{}', autoApply: true },
    };
    expect(migrate(raw, undefined).entries.e?.autoApply).toBe(true);
  });
});

describe('shouldAutoApply', () => {
  const meta = (globallyDisabled = false): Meta => ({
    schemaVersion: SCHEMA_VERSION,
    globallyDisabled,
  });
  const e = (enabled: boolean, autoApply: boolean): StyleEntry =>
    entry({ id: 'x', match: { type: 'host', value: 'a.com' }, enabled, autoApply });

  it('is true only when enabled, opted-in, and not globally disabled', () => {
    expect(shouldAutoApply(e(true, true), meta(false))).toBe(true);
  });

  it('is false when disabled, not opted-in, or kill switch is on', () => {
    expect(shouldAutoApply(e(false, true), meta(false))).toBe(false);
    expect(shouldAutoApply(e(true, false), meta(false))).toBe(false);
    expect(shouldAutoApply(e(true, true), meta(true))).toBe(false);
  });
});

describe('parseImport', () => {
  it('rejects non-JSON and foreign files', () => {
    expect(() => parseImport('not json')).toThrow();
    expect(() => parseImport(JSON.stringify({ app: 'something-else' }))).toThrow();
  });

  it('round-trips a valid bundle', () => {
    const bundle = {
      app: 'stylewright',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 1,
      entries: [entry({ id: 'x', match: { type: 'host', value: 'a.com' }, css: 'a{}' })],
      meta: { schemaVersion: SCHEMA_VERSION, globallyDisabled: false },
    };
    const { entries } = parseImport(JSON.stringify(bundle));
    expect(entries.x?.css).toBe('a{}');
  });

  it('still imports legacy css-overrides bundles', () => {
    const bundle = {
      app: 'css-overrides',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: 1,
      entries: [entry({ id: 'y', match: { type: 'host', value: 'b.com' }, css: 'b{}' })],
      meta: { schemaVersion: SCHEMA_VERSION, globallyDisabled: false },
    };
    const { entries } = parseImport(JSON.stringify(bundle));
    expect(entries.y?.css).toBe('b{}');
  });
});
