/**
 * Functions serialized into the page via `chrome.scripting.executeScript`, so
 * they must be fully self-contained — no imports, no closure over module scope.
 * That's why the element id is repeated as a literal in each one.
 */

export const STYLE_ELEMENT_ID = 'stylewright-injected-style';

export function applyStyleInPage(css: string): void {
  const id = 'stylewright-injected-style';
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    // documentElement is always present, even before <head> parses.
    (document.head ?? document.documentElement).appendChild(el);
  }
  el.textContent = css;
}

export function removeStyleInPage(): void {
  document.getElementById('stylewright-injected-style')?.remove();
}

export function isStylePresentInPage(): boolean {
  return document.getElementById('stylewright-injected-style') !== null;
}
