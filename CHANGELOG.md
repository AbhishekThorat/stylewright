# Changelog

## 0.1.1

### Patch Changes

- Fix the side panel showing "No site / This page can't be styled" on ordinary
  pages. The panel opened via `openPanelOnActionClick`, which consumed the toolbar
  click and never granted `activeTab`, so it could not read the active tab's URL.
  The toolbar click is now handled directly (granting `activeTab` and opening the
  panel), tabs that haven't been activated show a clear "click the icon" prompt
  instead of the misleading "can't be styled" message, and the panel re-reads
  context immediately after the grant.

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/) and uses
[Changesets](https://github.com/changesets/changesets) for release notes.

## 0.1.0 — Unreleased

Initial release.

### Added

- Per-site CSS overrides keyed by hostname, pre-loaded into the editor when you
  open the panel.
- Side-panel editor (CodeMirror 6) with **Clear**, **Disable**, and **Apply**.
- Manual-only injection — styles are never applied automatically on page load.
- Global kill switch to disable all overrides at once.
- JSON export / import of all overrides.
- Light/dark theme support.
- Minimal permissions (`activeTab`, `scripting`, `storage`) with per-origin
  access requested on demand.
- Strict production Content Security Policy (`connect-src 'none'`) that makes the
  no-network guarantee enforceable at the browser level.
