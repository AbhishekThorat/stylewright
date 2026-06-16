// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  STYLE_ELEMENT_ID,
  applyStyleInPage,
  isStylePresentInPage,
  removeStyleInPage,
} from '../inject';

describe('injection DOM contract', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('creates a single managed <style> and sets its CSS', () => {
    applyStyleInPage('body { color: red; }');
    const el = document.getElementById(STYLE_ELEMENT_ID);
    expect(el?.tagName).toBe('STYLE');
    expect(el?.textContent).toBe('body { color: red; }');
  });

  it('updates the existing element instead of creating duplicates', () => {
    applyStyleInPage('a {}');
    applyStyleInPage('b {}');
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
    expect(document.getElementById(STYLE_ELEMENT_ID)?.textContent).toBe('b {}');
  });

  it('removes the element on disable, idempotently', () => {
    applyStyleInPage('a {}');
    expect(isStylePresentInPage()).toBe(true);
    removeStyleInPage();
    expect(isStylePresentInPage()).toBe(false);
    // Calling remove again must not throw.
    expect(() => removeStyleInPage()).not.toThrow();
  });

  it('reports presence accurately', () => {
    expect(isStylePresentInPage()).toBe(false);
    applyStyleInPage('a {}');
    expect(isStylePresentInPage()).toBe(true);
  });
});
