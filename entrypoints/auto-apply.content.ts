/**
 * Opt-in auto-apply (v2). Runs at `document_start` to inject a site's saved CSS
 * before the page paints, so an enabled + auto-apply override survives reloads
 * and fresh tabs (see ADR 0002).
 *
 * `registration: 'runtime'` keeps this OUT of the manifest — and crucially keeps
 * its `matches` out of `host_permissions`, preserving the minimal-permission
 * promise (invariant #6). The background registers it per-origin via
 * `chrome.scripting.registerContentScripts` only after the user opts in and the
 * origin's host permission is granted. `matches: []` here adds nothing.
 *
 * Storage is the source of truth; this only derives the injected <style>
 * (invariant #4). The gate (`shouldAutoApply`) is shared with the worker, so the
 * global kill switch and per-site Disable suppress auto-apply with no extra
 * registration churn.
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
