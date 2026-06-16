# Publishing

CSS Overrides ships to the Chrome Web Store (Brave installs from the same
listing). Releases are cut with [Changesets](https://github.com/changesets/changesets).

## Cutting a release

1. Make sure every user-facing change has a changeset:
   ```bash
   npx changeset
   ```
2. Apply the pending changesets to bump the version and update the changelog:
   ```bash
   npm run version
   git commit -am "release: vX.Y.Z"
   ```
3. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push --follow-tags
   ```
   The **Release** workflow verifies, builds, packages the zip, and attaches it
   to a GitHub Release.

## Submitting to the Chrome Web Store

This step is manual and credentialed on purpose — store submission should be a
deliberate human action.

1. Download the zip from the GitHub Release (or run `npm run release` locally).
2. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Upload the new zip, update the listing/screenshots if needed, and submit for
   review.

### Listing requirements checklist

- [ ] Privacy policy linked (`PRIVACY.md`).
- [ ] Permission justifications:
  - `activeTab` — inject the user's CSS into the current tab on click.
  - `scripting` — the API that performs the injection.
  - `storage` / `unlimitedStorage` — store overrides locally.
  - `sidePanel` — host the editor UI.
  - `optional_host_permissions` — requested per-origin, on demand, only when a
    user applies to a site `activeTab` doesn't already cover.
- [ ] Screenshots of the side panel.
- [ ] "No data collected" declared in the privacy practices form.

## Automating store upload (optional, later)

To automate submission, add `chrome-webstore-upload-cli` and store the
`EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, and `REFRESH_TOKEN` as GitHub
Actions encrypted secrets — never in the repo. This is deferred until release
cadence justifies it.
