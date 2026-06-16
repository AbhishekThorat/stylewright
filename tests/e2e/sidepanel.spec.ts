import { expect, test } from './fixtures';

// The side panel can't be programmatically bound to an arbitrary tab from
// Playwright, so the live apply→disable flow is covered by the jsdom unit tests
// for the injection contract. Here we smoke-test that the real extension loads
// in Chromium and the panel renders its core controls and guards.

test('extension loads and registers a service worker', async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/);
});

test('side panel renders the editor and the three actions', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await expect(page.locator('.app-name')).toHaveText('CSS Overrides');
  // The header uses the same icon as the toolbar; confirm it actually loads
  // (also proves the CSP allows packaged images).
  const logoLoaded = await page
    .locator('img.logo')
    .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
  expect(logoLoaded).toBe(true);
  await expect(page.locator('#clearBtn')).toBeVisible();
  await expect(page.locator('#disableBtn')).toBeVisible();
  await expect(page.locator('#applyBtn')).toBeVisible();
  // CodeMirror mounts into #editor.
  await expect(page.locator('#editor .cm-editor')).toBeVisible();
});

test('guards against styling a non-injectable page', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  // The active tab is the extension page itself, which cannot be styled.
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#applyBtn')).toBeDisabled();
});

test('opening the menu reveals export/import and the kill switch', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  await page.locator('#menuBtn').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#killSwitch')).toBeVisible();
  await expect(page.locator('#exportBtn')).toBeVisible();
  await expect(page.locator('#importBtn')).toBeVisible();
});
