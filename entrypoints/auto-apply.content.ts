/**
 * Opt-in auto-apply: injects a site's saved CSS at `document_start` so an
 * enabled + auto-apply override survives reloads.
 *
 * `registration: 'runtime'` keeps this out of the manifest — and out of
 * `host_permissions` — so the background can register it per-origin only after
 * the user opts in and grants the origin. The empty `matches: []` here is inert.
 */

import { applyStyleInPage } from '@/src/lib/inject';
import { getEntryForUrl, getMeta, shouldAutoApply } from '@/src/lib/storage';

export default defineContentScript({
  registration: 'runtime',
  matches: [],
  runAt: 'document_start',
  async main() {
    try {
      const entry = await getEntryForUrl(location.href);
      if (!entry) return;
      const meta = await getMeta();
      if (shouldAutoApply(entry, meta)) applyStyleInPage(entry.css);
    } catch {
      // Best-effort: a storage hiccup must never break the page.
    }
  },
});
