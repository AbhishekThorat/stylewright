# Chrome Web Store listing copy

Ready-to-paste content for the Stylewright listing in the
[Developer Dashboard](https://chrome.google.com/webstore/devconsole). Keep this
in sync with the manifest, README, and PRIVACY.md (single-brand rule in
[CLAUDE.md](../CLAUDE.md)). Character limits are the store's own.

---

## Item name

```
Stylewright
```

> If the bare name is ever flagged, fall back to `Stylewright — Local CSS Overrides`
> (the store allows a longer title than the brand word).

## Category

**Developer Tools** (primary). Secondary, if offered: *Accessibility* — many
users restyle sites for readability.

## Language

English (United States).

---

## Short description (max 132 chars)

Paste exactly (128 chars):

```
Write per-site CSS to restyle any website. Injected only when you click Apply. 100% local — no account, no network, no tracking.
```

Alternates if you want a different emphasis:

- Privacy-forward (118):
  `Restyle any site with your own CSS, saved per site. Nothing is applied automatically and nothing ever leaves your device.`
- Developer-forward (109):
  `A focused CodeMirror editor for per-site CSS overrides. Apply on click, opt in to auto-apply. 100% local.`

---

## Detailed description

> Store field allows ~16,000 chars; plain text with blank-line paragraphs.
> Markdown is **not** rendered — the dashes below render as literal bullets,
> which is the conventional look.

```
Stylewright lets you restyle any website with your own CSS — and keeps your styles separate for every site.

Open the side panel on any page and the editor pre-loads the CSS you last saved for that site. Edit it in a real CodeMirror editor (syntax highlighting, light/dark), then click Apply to inject it live. Your styles for facebook.com stay separate from every other site, and they're remembered for next time.

By design, nothing is applied automatically. Your CSS is injected only when you open the panel and click Apply — so the extension keeps minimal permissions and can never silently alter a page you visit. When you DO want a site styled on every visit, turn on its per-site "Apply automatically on page load" toggle; that's an explicit, per-site opt-in you can switch off anytime.

PRIVACY YOU CAN VERIFY
- No accounts. No sign-in.
- No network requests — no server, no analytics, no telemetry.
- Everything stays in your browser's local storage.
- This isn't just a promise: the production build ships a Content Security Policy with connect-src 'none', so the extension's pages physically cannot open a network connection.

FEATURES
- Per-site overrides — each site remembers its own CSS.
- Pre-loaded editor — opening the panel restores the last styles you saved for that site.
- Live apply — see changes instantly; the side panel stays open while you iterate.
- Manual by default — styles are never applied automatically unless you opt a site in.
- Opt-in auto-apply — per site, with a one-time permission prompt for that site only.
- Three clear actions — Clear (empty the editor), Disable (stop applying, keep the CSS), Apply (inject live).
- Global kill switch — turn off every override at once.
- Import / export — back up or move your overrides as JSON. Nothing leaves your device unless you export it yourself.
- Modern UI — a focused CodeMirror editor with light/dark support.

MINIMAL PERMISSIONS
Stylewright does not request blanket "read and change all your data on all websites" access. It uses activeTab so it can only touch a page when you click Apply, and it asks for access to a specific site — one origin at a time — only when you turn on auto-apply for that site.

GOOD TO KNOW (a few limits, by design)
- Styles don't survive a full page reload unless you opt that site into auto-apply (manual-only is the default).
- Cross-origin iframes and closed Shadow DOM can't be styled — the browser seals these off from page CSS.
- Browser-internal pages (chrome://, the Web Store, other extensions) can't be styled.
- file:// pages need "Allow access to file URLs" enabled for the extension.

Works in Chrome and Brave (and other Chromium browsers).

Open source — built in the open. Source, issues, and the full privacy policy are linked below.
```

---

## Single purpose (required field)

```
Stylewright has a single purpose: let users write and apply their own custom CSS to websites, saved on a per-site basis, applied on demand (or via an explicit per-site auto-apply opt-in).
```

---

## Permission justifications

Paste one per permission in the dashboard's "Privacy practices" → permission
justification fields. These mirror [docs/PUBLISHING.md](./PUBLISHING.md).

| Permission | Justification |
| --- | --- |
| `activeTab` | Injects the user's CSS into the current tab, only in response to an explicit Apply click. Avoids broad host access. |
| `scripting` | The API used to inject the user's CSS (a single managed `<style>` element) and to register the per-site auto-apply script. |
| `storage` | Saves the user's per-site CSS overrides and settings locally. |
| `unlimitedStorage` | Lets users keep large/many stylesheets without hitting the default 5 MB `storage.local` quota. All local. |
| `sidePanel` | Hosts the editor UI in the browser side panel. |
| Host permissions (`optional_host_permissions`) | Requested per-origin, on demand, only when a user opts a specific site into auto-apply (load-time injection has no user gesture, so `activeTab` can't cover it). One origin at a time; revoked when no auto-apply entry needs it. |

> "Remote code" question: **No**, the extension does not use remote code. All
> code is packaged; CSP blocks remote and inline scripts.

---

## Privacy practices form

- **Privacy policy URL (required):** host [PRIVACY.md](../PRIVACY.md) at a public
  URL (GitHub Pages, or the raw file link) and paste it here.
- **What user data do you collect?** — select **none**. Stylewright collects no
  data of any category.
- **Data usage certifications** (check all — all true):
  - [x] I do not sell or transfer user data to third parties (outside approved use cases).
  - [x] I do not use or transfer user data for purposes unrelated to my item's single purpose.
  - [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

---

## Assets to attach

- **Icon:** 128×128 (already generated, `icon/128.png`).
- **Screenshots (required):** at least one **1280×800** (or 640×400). See the
  screenshot plan below. Show: (1) the panel with CSS applied to a real site,
  (2) the editor with sample CSS, (3) the per-site auto-apply toggle, (4) the
  menu (kill switch / export-import). Light and dark variants are nice-to-have.
- **Small promo tile (optional):** 440×280.

---

## Pre-submit checklist

- [ ] `npm run zip` → `.output/stylewright-<version>-chrome.zip` ready.
- [ ] Privacy policy hosted; URL pasted.
- [ ] Short + detailed description pasted.
- [ ] Single-purpose + all permission justifications filled.
- [ ] "No data collected" + the three certifications checked.
- [ ] At least one 1280×800 screenshot uploaded.
- [ ] Category = Developer Tools.
