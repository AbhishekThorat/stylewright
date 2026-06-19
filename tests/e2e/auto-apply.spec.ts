import { type Server, createServer } from 'node:http';
import type { Worker } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Auto-apply (ADR 0002) is the one path the jsdom unit tests can't cover: a
 * `document_start` content script, registered per-origin, that injects a site's
 * saved CSS on load and respects the `shouldAutoApply` gate. This exercises it
 * end-to-end against a local server.
 *
 * The opt-in flow normally grants a per-origin host permission via a user-gesture
 * prompt, which headless Chromium can't accept. But Chrome-for-Testing already
 * grants `http://localhost/*`, so we register the same content script the
 * background would (`registerContentScripts`) and seed storage directly — the
 * load-time injection and the gate are what we're verifying, not the prompt.
 */

const PATTERN = 'http://localhost/*';

function startServer(): Promise<{ server: Server; port: number }> {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><html><head></head><body><p id="t">page</p></body></html>');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as { port: number }).port });
    });
  });
}

async function getWorker(context: import('@playwright/test').BrowserContext): Promise<Worker> {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return worker;
}

/** Register the auto-apply script + seed one entry, the way opt-in would. */
async function seedAutoApply(
  worker: Worker,
  opts: { port: number; css: string; enabled?: boolean; autoApply?: boolean; killed?: boolean },
): Promise<{ granted: boolean }> {
  return worker.evaluate(
    async ({ pattern, port, css, enabled, autoApply, killed }) => {
      const granted = await chrome.permissions.contains({ origins: [pattern] }).catch(() => false);
      if (!granted) return { granted: false };
      await chrome.scripting.registerContentScripts([
        {
          id: 'aa-localhost-e2e',
          matches: [pattern],
          js: ['content-scripts/auto-apply.js'],
          runAt: 'document_start',
          persistAcrossSessions: false,
        },
      ]);
      await chrome.storage.local.set({
        overrides: {
          e2e: {
            id: 'e2e',
            // Host matches are exact host:port, so include the server's port.
            match: { type: 'host', value: `localhost:${port}` },
            css,
            enabled,
            autoApply,
            updatedAt: Date.now(),
            schemaVersion: 2,
          },
        },
        meta: { schemaVersion: 2, globallyDisabled: killed },
      });
      return { granted: true };
    },
    {
      pattern: PATTERN,
      port: opts.port,
      css: opts.css,
      enabled: opts.enabled ?? true,
      autoApply: opts.autoApply ?? true,
      killed: opts.killed ?? false,
    },
  );
}

test('auto-applies an opted-in site’s CSS at load', async ({ context }) => {
  const { server, port } = await startServer();
  try {
    const worker = await getWorker(context);
    const { granted } = await seedAutoApply(worker, {
      port,
      css: 'html { background-color: rgb(1, 2, 3); }',
    });
    test.skip(!granted, 'http://localhost/* is not granted in this Chromium build');

    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });

    // The managed <style> is present…
    await expect(page.locator('#stylewright-injected-style')).toHaveCount(1);
    // …and actually took effect (proves it injected, not just that the tag exists).
    const bg = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(bg).toBe('rgb(1, 2, 3)');

    await page.close();
  } finally {
    server.close();
  }
});

test('the global kill switch suppresses auto-apply at load', async ({ context }) => {
  const { server, port } = await startServer();
  try {
    const worker = await getWorker(context);
    const { granted } = await seedAutoApply(worker, {
      port,
      css: 'html { background-color: rgb(1, 2, 3); }',
      killed: true,
    });
    test.skip(!granted, 'http://localhost/* is not granted in this Chromium build');

    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });

    await expect(page.locator('#stylewright-injected-style')).toHaveCount(0);
    const bg = await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
    expect(bg).not.toBe('rgb(1, 2, 3)');

    await page.close();
  } finally {
    server.close();
  }
});
