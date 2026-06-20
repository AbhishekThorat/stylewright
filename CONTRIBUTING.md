# Contributing to Stylewright

Thanks for your interest in improving Stylewright! This document explains how
to get set up and the conventions we follow.

## Getting started

```bash
git clone https://github.com/abhishekthorat/stylewright.git
cd stylewright
npm install
npm run dev      # Chrome/Brave with HMR
```

## Project layout

```
entrypoints/         WXT entrypoints
  background.ts      Service worker: storage, permissions, injection
  sidepanel/         The editor UI (side panel)
src/lib/             Pure, testable logic
  match.ts           Hostname normalization + match resolution
  storage.ts         Storage schema, read/write, migrations
  inject.ts          The function injected into pages
  messages.ts        Typed message contracts (panel <-> worker)
tests/e2e/           Playwright end-to-end tests
```

## Development workflow

| Command | Description |
| --- | --- |
| `npm run dev` | Run the extension with live reload |
| `npm run build` | Production build (`.output/chrome-mv3`) |
| `npm run zip` | Package for the Chrome Web Store |
| `npm run check` | Biome lint + format check |
| `npm run format` | Auto-format with Biome |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |

Before opening a PR, please run `npm run check && npm run typecheck && npm test`.
CI runs all of these.

## Coding standards

- **TypeScript, strict mode.** No `any` without a clear reason.
- **Keep logic out of the UI.** Anything with branching logic (matching,
  normalization, storage) lives in `src/lib` and has unit tests.
- **Never use `innerHTML`** in the panel. Render with `textContent` or the
  CodeMirror document API — stored CSS is treated as untrusted by default.
- **Storage is the source of truth.** The injected `<style>` element is derived
  state; never read application state back out of the DOM.
- Format with Biome (`npm run format`). CI enforces it.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(panel): add global kill switch
fix(inject): remove style element on disable
docs: document permission model
```

Versioning and changelogs are managed with
[Changesets](https://github.com/changesets/changesets). If your change is
user-facing, run `npx changeset` and describe it.

## Reporting bugs / requesting features

Open an issue using the relevant template. For security issues, please follow
[SECURITY.md](./SECURITY.md) instead of opening a public issue.
