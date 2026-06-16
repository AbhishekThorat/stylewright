import { describe, expect, it } from 'vitest';
import {
  defaultMatchForUrl,
  hostKeyFromUrl,
  isInjectableUrl,
  matchesUrl,
  normalizeHost,
} from '../match';

describe('normalizeHost', () => {
  it('lowercases and strips a single leading www.', () => {
    expect(normalizeHost('WWW.Example.COM')).toBe('example.com');
    expect(normalizeHost('example.com')).toBe('example.com');
  });

  it('does not strip www inside the host', () => {
    expect(normalizeHost('wwwexample.com')).toBe('wwwexample.com');
    expect(normalizeHost('my.www.example.com')).toBe('my.www.example.com');
  });
});

describe('hostKeyFromUrl', () => {
  it('returns the normalized host for http(s)', () => {
    expect(hostKeyFromUrl('https://www.facebook.com/feed')).toBe('facebook.com');
    expect(hostKeyFromUrl('http://example.com')).toBe('example.com');
  });

  it('keeps the port when present so dev origins stay distinct', () => {
    expect(hostKeyFromUrl('http://localhost:3000/')).toBe('localhost:3000');
    expect(hostKeyFromUrl('http://localhost:8080/')).toBe('localhost:8080');
  });

  it('keeps subdomains distinct from the apex', () => {
    expect(hostKeyFromUrl('https://mail.google.com')).toBe('mail.google.com');
  });

  it('returns null for non-injectable schemes and junk', () => {
    expect(hostKeyFromUrl('chrome://extensions')).toBeNull();
    expect(hostKeyFromUrl('not a url')).toBeNull();
  });
});

describe('isInjectableUrl', () => {
  it('accepts http and https pages', () => {
    expect(isInjectableUrl('https://example.com')).toBe(true);
    expect(isInjectableUrl('http://localhost:3000')).toBe(true);
  });

  it('rejects browser-internal pages and the web store', () => {
    expect(isInjectableUrl('chrome://settings')).toBe(false);
    expect(isInjectableUrl('about:blank')).toBe(false);
    expect(isInjectableUrl('https://chromewebstore.google.com/detail/x')).toBe(false);
    expect(isInjectableUrl(undefined)).toBe(false);
    expect(isInjectableUrl(null)).toBe(false);
  });
});

describe('matchesUrl', () => {
  it('matches host rules exactly on the normalized key', () => {
    const m = { type: 'host', value: 'example.com' } as const;
    expect(matchesUrl(m, 'https://www.example.com/page')).toBe(true);
    expect(matchesUrl(m, 'https://sub.example.com/page')).toBe(false);
    expect(matchesUrl(m, 'https://example.org')).toBe(false);
  });

  it('matches domain rules on the apex and its subdomains', () => {
    const m = { type: 'domain', value: 'example.com' } as const;
    expect(matchesUrl(m, 'https://example.com')).toBe(true);
    expect(matchesUrl(m, 'https://mail.example.com')).toBe(true);
    expect(matchesUrl(m, 'https://notexample.com')).toBe(false);
  });

  it('matches url-prefix rules', () => {
    const m = { type: 'url-prefix', value: 'https://x.com/settings' } as const;
    expect(matchesUrl(m, 'https://x.com/settings/profile')).toBe(true);
    expect(matchesUrl(m, 'https://x.com/home')).toBe(false);
  });

  it('matches regex rules and never throws on a bad pattern', () => {
    expect(matchesUrl({ type: 'regex', value: '^https://a\\.com' }, 'https://a.com/x')).toBe(true);
    expect(matchesUrl({ type: 'regex', value: '(' }, 'https://a.com')).toBe(false);
  });
});

describe('defaultMatchForUrl', () => {
  it('builds a host match or null', () => {
    expect(defaultMatchForUrl('https://www.example.com')).toEqual({
      type: 'host',
      value: 'example.com',
    });
    expect(defaultMatchForUrl('chrome://x')).toBeNull();
  });
});
