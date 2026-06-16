# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability, please **do not open a public issue**.
Instead, report it privately via
[GitHub Security Advisories](https://github.com/abhishekthorat/css-overrides/security/advisories/new)
or by emailing the maintainer at **abhishek.thorat18@gmail.com**.

We will acknowledge your report within 72 hours and aim to ship a fix promptly.

## Scope and threat model

CSS Overrides injects **user-authored CSS** into pages at the user's explicit
request. Some notes on the threat model:

- The extension makes **no network requests** and has **no backend**. All data
  stays in `chrome.storage.local`. This is enforced at the browser level: the
  production build ships a Content Security Policy with `connect-src 'none'`, so
  the extension's own pages cannot open a network connection even if a bug or a
  malicious dependency tried to.
- CSS you write is injected as-is. CSS can leak data via `url()` and `@import`
  (e.g. `background: url(https://example.com/?leak)`). Because you author your
  own CSS, this is self-inflicted and accepted for the current feature set.
- **If we ever add importing CSS from a URL or community sharing**, external
  `url()` and `@import` will be sanitized or sandboxed, since the trust model
  changes at that point.
- The panel never renders stored values with `innerHTML`; everything uses
  `textContent` or the editor's document API.

## Supported versions

Security fixes are applied to the latest released version.
