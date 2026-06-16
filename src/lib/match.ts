/**
 * Hostname normalization and match resolution.
 *
 * The storage schema keys overrides by an opaque id and carries a `match`
 * object (see ADR 0001), so the matching model can grow without a data
 * migration. v1 only writes `type: 'host'`; the other branches are seams.
 */

export type MatchType = 'host' | 'domain' | 'url-prefix' | 'regex';

export interface Match {
  type: MatchType;
  value: string;
}

/** Schemes we are willing to inject CSS into. Everything else is off-limits. */
const INJECTABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

/**
 * Normalize a hostname for use as a match key: lowercased, with a single
 * leading `www.` stripped so `www.example.com` and `example.com` share styles.
 */
export function normalizeHost(hostname: string): string {
  const lower = hostname.trim().toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
}

/**
 * Build the default host match value from a URL. The port is included only
 * when present and non-default, so `localhost:3000` and `localhost:8080` are
 * distinct keys while everyday `https://example.com` is just `example.com`.
 *
 * Returns `null` for URLs we cannot or should not key (e.g. `chrome://`).
 */
export function hostKeyFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!INJECTABLE_PROTOCOLS.has(parsed.protocol)) return null;

  const host = normalizeHost(parsed.hostname);
  if (!host) return null;
  return parsed.port ? `${host}:${parsed.port}` : host;
}

/**
 * Whether the extension can inject into this URL at all. Browser-internal
 * pages (`chrome://`, the Web Store, `about:`, …) reject injection.
 */
export function isInjectableUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!INJECTABLE_PROTOCOLS.has(parsed.protocol)) return false;

  // The Chrome Web Store blocks extension scripting.
  const host = parsed.hostname;
  if (host === 'chromewebstore.google.com' || host === 'chrome.google.com') return false;
  return true;
}

/**
 * Does a match rule apply to the given URL?
 *
 * - `host`: exact normalized host[:port] equality (the v1 default).
 * - `domain`: the registrable-domain seam — host equals the value or is a
 *   subdomain of it. (A Public Suffix List is intentionally deferred; see ADR.)
 * - `url-prefix`: the URL starts with the value.
 * - `regex`: the value, compiled, tests the URL. Invalid patterns never match.
 */
export function matchesUrl(match: Match, url: string): boolean {
  switch (match.type) {
    case 'host': {
      const key = hostKeyFromUrl(url);
      return key !== null && key === match.value;
    }
    case 'domain': {
      const key = hostKeyFromUrl(url);
      if (key === null) return false;
      const host = key.split(':')[0] ?? key;
      const value = normalizeHost(match.value);
      return host === value || host.endsWith(`.${value}`);
    }
    case 'url-prefix':
      return url.startsWith(match.value);
    case 'regex': {
      try {
        return new RegExp(match.value).test(url);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

/** Build the default (host-type) match for a URL, or `null` if not injectable. */
export function defaultMatchForUrl(url: string): Match | null {
  const value = hostKeyFromUrl(url);
  return value === null ? null : { type: 'host', value };
}
