<div align="center">

# CSS Overrides

**A clean, modern browser extension for writing per-site CSS overrides.**

[![CI](https://github.com/abhishekthorat/css-overrides/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishekthorat/css-overrides/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-success.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

</div>

CSS Overrides lets you restyle any website with your own CSS. It remembers the
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

## Install

### From source (development)

```bash
git clone https://github.com/abhishekthorat/css-overrides.git
cd css-overrides
npm install
npm run dev          # launches Chrome with the extension loaded (HMR)
```

To produce a loadable build:

```bash
npm run build        # output in .output/chrome-mv3
npm run zip          # packaged zip for the Chrome Web Store
```

Then load the unpacked `.output/chrome-mv3` directory via `chrome://extensions`
→ **Developer mode** → **Load unpacked**. Works in Chrome and Brave.

## Privacy

CSS Overrides collects **no data** and makes **no network requests**. Everything
you type stays in your browser's local storage. See [PRIVACY.md](./PRIVACY.md).

## Permissions

The extension requests the minimum needed to work:

| Permission | Why |
| --- | --- |
| `activeTab` | Inject your CSS into the current tab — only when you click Apply. |
| `scripting` | The API used to perform the injection. |
| `storage` | Save your per-site overrides locally. |

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
behind it are documented in [docs/adr](./docs/adr).

## License

[MIT](./LICENSE) © Abhishek Thorat
