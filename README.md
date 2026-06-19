<div align="center">

# Stylewright

**Stylewright — a clean, modern browser extension for writing per-site CSS overrides. 100% local.**

[![CI](https://github.com/abhishekthorat/css-overrides/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishekthorat/css-overrides/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

</div>

Stylewright lets you restyle any website with your own CSS. It remembers the
last styles you used **per site** and pre-loads them into the editor the next
time you open the panel — so `facebook.com` keeps its own overrides, separate
from every other site.

> **By design, nothing is applied automatically.** Your CSS is only injected
> when you open the panel and click **Apply**. This keeps the extension's
> permissions minimal and means it can never silently alter a page you visit.

## Features

- 🎯 **Per-site overrides** — each hostname remembers its own CSS.
- ✍️ **Pre-loaded editor** — opening the panel restores the last styles you saved for that site.
- 🧩 **Live apply** — see your changes instantly; the side panel stays open while you iterate.
- 🛑 **Manual by design** — styles are never applied automatically on page load.
- 🎛️ **Three clear actions** — **Clear** (empty the editor), **Disable** (stop applying, keep the CSS), **Apply** (inject live).
- 🔌 **Global kill switch** — turn off every override at once.
- 📦 **Import / export** — back up or move your overrides as JSON. Nothing ever leaves your device.
- 🌗 **Modern UI** — a focused CodeMirror editor with light/dark support.

## How it works

1. Open the side panel on any site.
2. The editor pre-loads the CSS you last saved for that site (or starts empty).
3. Edit your CSS. Click **Apply** to inject it live.
4. Use **Disable** to stop applying without losing your CSS, or **Clear** to empty the editor.

Overrides are stored locally (`chrome.storage.local`) and keyed by a flexible
match rule (host by default), so the data model is ready for domain-wide and
path-specific rules in the future.

## Limitations

Stylewright injects a stylesheet into the page on demand. Because of how the
browser and CSS work, a few things are out of scope:

- **Closed Shadow DOM can't be styled.** Components using a *closed* shadow root
  (some web components, certain native widgets) are sealed off from page CSS —
  the injected stylesheet can't reach inside. *Open* shadow roots can be reached
  only via `::part()`/`::slotted()` where the component exposes them.
- **Cross-origin iframes are not styled.** Overrides apply to the top frame
  only. Content inside a third-party iframe (embeds, some login widgets) is a
  separate origin the extension intentionally does not touch.
- **Browser-internal pages are off-limits.** `chrome://`, `brave://`,
  `about:`, the Chrome Web Store, and other extensions' pages can't be styled —
  the browser blocks injection there.
- **Styles don't survive a full page reload.** By design, nothing is applied
  automatically; after a hard navigation you reopen the panel and click Apply
  again. (Your saved CSS is still there, pre-loaded.) In-page SPA navigation
  *does* keep the styles.
- **`file://` pages need a manual toggle.** Styling local files requires
  enabling "Allow access to file URLs" for the extension in `chrome://extensions`.
- **User-agent shadow internals** (e.g. the inner pieces of native form
  controls) are only stylable to the extent the browser exposes pseudo-elements.

## Run it locally

```bash
git clone https://github.com/abhishekthorat/css-overrides.git
cd css-overrides
npm install
```

**Develop with hot reload:**

```bash
npm run dev          # launches your browser with the extension loaded (HMR)
```

By default this looks for Google Chrome. **If you only have Brave** (or another
Chromium browser), point WXT at it once — copy the template and it's picked up
automatically:

```bash
cp web-ext.config.example.ts web-ext.config.ts
# edit web-ext.config.ts and set the binary path for your OS, e.g. macOS Brave:
#   /Applications/Brave Browser.app/Contents/MacOS/Brave Browser
```

`web-ext.config.ts` is gitignored (the path is personal to your machine), so
this never affects other contributors. `npm run dev` will now launch Brave and
open a test page (`example.com`) where you can try the side panel.

> If the launched tab ever shows a `localhost:3000` **404**, that's just WXT's
> empty dev-server root — harmless. The extension is loaded regardless; open any
> normal website and click the toolbar icon. Setting `startUrls` (as the
> template does) avoids landing there.

**Or build and load it manually:**

```bash
npm run build        # output in .output/chrome-mv3
```

1. Open `chrome://extensions` (or `brave://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
4. Pin the extension and click it to open the side panel on any website.

**Run the checks the way CI does:**

```bash
npm run check        # lint + format
npm run typecheck
npm test             # unit tests
npm run build && npm run test:e2e   # end-to-end in real Chromium
```

## Releases & publishing

Releases are **trunk-based and automated**. There is no release branch — you cut
a release by tagging `vX.Y.Z` on `main`, and CD takes over:

```
CI  every push / PR  → lint, typecheck, unit tests, build, e2e
CD  push tag vX.Y.Z  → verify, build, GitHub Release, publish to the Web Store
```

```bash
npx changeset           # describe a user-facing change (during development)
npm run version         # bump version + update CHANGELOG from changesets
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z && git push --follow-tags   # ← triggers the release pipeline
```

The first store submission is manual (to create the listing and get the
extension ID); after that, tagging auto-publishes new versions. The complete
walkthrough — developer account, the one-time listing, getting the Google API
credentials/refresh token, and the GitHub secrets to set — is in
**[docs/PUBLISHING.md](./docs/PUBLISHING.md)**. Brave users install from the same
Chrome Web Store listing.

## Privacy & security

Stylewright collects **no data** and makes **no network requests** — there is
no server, no analytics, and no telemetry. Everything you type stays in your
browser's local storage. This is enforced, not just promised: the production
build ships a Content Security Policy with `connect-src 'none'`, so the
extension's pages physically cannot open a network connection. See
[PRIVACY.md](./PRIVACY.md) and [SECURITY.md](./SECURITY.md).

### Permissions

The extension requests the minimum needed to work:

| Permission | Why |
| --- | --- |
| `activeTab` | Inject your CSS into the current tab — only when you click Apply. |
| `scripting` | The API used to perform the injection. |
| `storage` / `unlimitedStorage` | Save your per-site overrides locally. |
| `sidePanel` | Host the editor UI. |

It does **not** request blanket "read and change all your data on all websites"
access. Per-site access is requested on demand, one origin at a time.

## Tech stack

- [WXT](https://wxt.dev/) — Manifest V3 framework (Chrome/Brave)
- TypeScript
- [CodeMirror 6](https://codemirror.net/) — the CSS editor
- [Biome](https://biomejs.dev/) — lint + format
- [Vitest](https://vitest.dev/) — unit tests
- [Playwright](https://playwright.dev/) — end-to-end tests

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and
our [Code of Conduct](./CODE_OF_CONDUCT.md). The architecture and the decisions
behind it are documented in [docs/adr](./docs/adr), and assistant-facing notes
live in [CLAUDE.md](./CLAUDE.md).

## Built with Claude 🤖

This project — its architecture, code, tests, icons, and docs — was designed and
built with [**Claude**](https://claude.com/claude-code) (Anthropic's Claude
Opus, via Claude Code), including two senior-architecture review passes that
shaped the side-panel design, the storage schema, and the security model. Kudos
and thanks to Claude for the heavy lifting. Every commit is co-authored
accordingly.

## License

[MIT](./LICENSE) © Abhishek Thorat
