# Changelog

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
