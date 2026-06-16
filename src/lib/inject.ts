/**
 * Functions injected into the page via `chrome.scripting.executeScript`.
 *
 * These run in the page's world and are serialized by reference, so they must
 * be fully self-contained — no imports, no closure over module scope. That's
 * why the element id is repeated as a literal inside each function rather than
 * shared from a constant.
 *
 * We manage a single <style> element (rather than insertCSS/removeCSS) so apply
 * = set textContent and disable = remove the element — unambiguous, with no
 * exact-string matching required. See ADR 0001.
 */

export const STYLE_ELEMENT_ID = 'css-overrides-injected-style';

/** Runs in the page: find-or-create the managed <style> and set its CSS. */
export function applyStyleInPage(css: string): void {
  const id = 'css-overrides-injected-style';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    // documentElement is always present, even before <head> parses.
    (document.head ?? document.documentElement).appendChild(el);
  }
  el.textContent = css;
}

/** Runs in the page: remove the managed <style> if present. */
export function removeStyleInPage(): void {
  document.getElementById('css-overrides-injected-style')?.remove();
}

/** Runs in the page: report whether the managed <style> is currently present. */
export function isStylePresentInPage(): boolean {
  return document.getElementById('css-overrides-injected-style') !== null;
}
