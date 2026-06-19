# Screenshots & demo GIF — capture guide

Store screenshots and the README GIF must show the **real docked side panel**
next to a real page. That can't be automated (Playwright can't open Chrome's side
panel), so capture them by hand — ~10 minutes. Do this in **Brave or Chrome**
with the unpacked build loaded (`npm run build` → load `.output/chrome-mv3`).

## Specs

| Asset | Size | Format | Where |
| --- | --- | --- | --- |
| Store screenshots | **1280×800** (or 640×400) | PNG | Web Store listing — at least 1, up to 5 |
| Small promo tile (optional) | 440×280 | PNG | Web Store listing |
| README demo | GIF or MP4, ~800px wide | GIF/MP4 | `docs/assets/demo.gif` |

Save store images to `docs/assets/store/` (create it). They go in the dashboard,
not the repo's required path — but keeping them versioned is handy.

## Setup for a clean shot

1. Build + load unpacked; pin the toolbar icon.
2. Set the browser window to a clean size and use a **2× / Retina** display, then
   downscale to 1280×800 so text stays crisp. (macOS: a Retina screen already
   captures at 2×.)
3. Hide bookmarks bar and personal tabs. Use a fresh profile if convenient.
4. Pick a recognizable, uncluttered site so the before/after reads instantly —
   e.g. `example.com`, `news.ycombinator.com`, or a docs page.

## The shots (matches the listing copy)

Capture each at 1280×800. On macOS use **⌘⇧4 then Space** to grab a window, or
**⌘⇧5** for a fixed region / recording.

1. **Hero — CSS applied to a real site.** Open the panel on Hacker News, paste
   the sample below, click **Apply**. Capture the panel + restyled page together.
   This is the primary listing image.
2. **The editor with sample CSS.** Close-up of the side panel showing the
   CodeMirror editor full of CSS and the **Clear / Disable / Apply** row.
3. **Per-site auto-apply.** Show the "Apply automatically on page load" toggle on,
   ideally with the one-time permission prompt visible (re-trigger by removing the
   site's access in `chrome://extensions` → Details → Site access, then toggling).
4. **The menu.** Open the ⋯ menu showing the global kill switch ("Disable all
   overrides"), "Delete saved styles for this site", and Export/Import.

Optionally re-shoot #1 and #2 in **dark mode** (toggle OS theme) for light+dark
variants.

### Paste-ready sample CSS (Hacker News — obvious, tasteful before/after)

```css
body {
  background: #0f1220;
  font-family: ui-sans-serif, system-ui, sans-serif;
}
.athing { padding: 6px 0; }
.titleline > a {
  color: #c7d2fe;
  font-size: 15px;
}
a:visited { color: #818cf8; }
.subtext { color: #8b93a7; }
table#hnmain { width: min(900px, 94vw); margin: 0 auto; }
```

## README demo GIF

1. Record with **⌘⇧5** (macOS) or [LICEcap](https://www.cockos.com/licecap/) /
   [Kap](https://getkap.co/), ~800px wide, a few seconds.
2. Show the loop: open the panel → type/paste CSS → click **Apply** → page
   restyles live. Optionally toggle **Disable** to show it revert.
3. Export to GIF, keep it under ~5 MB, save to `docs/assets/demo.gif`.
4. Embed near the top of the README:
   ```markdown
   <p align="center"><img src="docs/assets/demo.gif" alt="Stylewright restyling a page live" width="800"></p>
   ```

## Don'ts

- No personal data, real names, logged-in accounts, or private URLs in frame.
- Don't show `chrome://` pages being styled (it's not supported and looks broken).
- Keep the accent indigo (`#4f46e5`) and the brace mark consistent — no other
  branding in the frame.
```
