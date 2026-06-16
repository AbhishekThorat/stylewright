# Publishing & Release

CSS Overrides ships to the Chrome Web Store (Brave installs from the same
listing). We use **trunk-based releases**: there is no release branch — you cut a
release by tagging `vX.Y.Z` on `main`, and that tag triggers the CD pipeline
(`.github/workflows/release.yml`), which verifies, builds, attaches the zip to a
GitHub Release, and — once credentials are configured — uploads and publishes the
new version to the Chrome Web Store automatically.

```
CI  (ci.yml)      every push / PR → lint, typecheck, unit, build, e2e
CD  (release.yml) push tag vX.Y.Z → verify, build, GitHub Release, CWS publish
```

---

## One-time setup

You only do this section once. After it, every release is just a tag push.

### 1. Create a Chrome Web Store developer account

1. Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Sign in and pay the **one-time US$5** registration fee.
3. Accept the developer agreement.

### 2. First submission (manual — creates the item and its ID)

The Web Store API can only **update an existing** item, and listing details
(description, screenshots, category, privacy answers) always live in the
dashboard. So the very first publish is manual:

1. Build the package locally: `npm run zip` → `.output/css-overrides-<version>-chrome.zip`.
2. In the dashboard, click **Add new item** and upload that zip.
3. Fill in the listing (see the [checklist](#listing-checklist) below) and
   **Submit for review**.
4. Open the item in the dashboard and copy its **Item ID** (a 32-character
   string). This is your `EXTENSION_ID`.

> Approval for a first submission usually takes a few business days.

### 3. Create Google API credentials (for automated publishing)

The CD pipeline talks to the Web Store API with OAuth. You need a **Client ID**,
**Client Secret**, and a **Refresh Token**.

1. **Google Cloud project** — open the [Google Cloud Console](https://console.cloud.google.com/),
   create (or pick) a project.
2. **Enable the API** — APIs & Services → **Library** → search **"Chrome Web
   Store API"** → **Enable**.
3. **OAuth consent screen** — APIs & Services → OAuth consent screen:
   - User type: **External**.
   - Fill app name + your email.
   - Add yourself as a **Test user**.
   - ⚠️ **Set the publishing status to "In production"** (Publish app). If you
     leave it in *Testing*, Google expires the refresh token after **7 days** and
     your pipeline will start failing a week later. "In production" for a
     personal, unverified app is fine for your own account.
4. **OAuth client** — APIs & Services → Credentials → **Create credentials** →
   **OAuth client ID**:
   - Application type: **Web application**.
   - Add an **Authorized redirect URI**: `https://developers.google.com/oauthplayground`.
   - Save, and copy the **Client ID** and **Client Secret**.
5. **Get the refresh token** via the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   - Click the ⚙️ (top right) → check **"Use your own OAuth credentials"** →
     paste your Client ID and Client Secret.
   - In **Step 1**, in the "Input your own scopes" box, enter:
     `https://www.googleapis.com/auth/chromewebstore`
   - Click **Authorize APIs**, sign in with the same Google account that owns the
     developer dashboard, and allow access.
   - In **Step 2**, click **Exchange authorization code for tokens** and copy the
     **Refresh token**.

### 4. Add the secrets to GitHub

Repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add all four:

| Secret | Value |
| --- | --- |
| `CWS_EXTENSION_ID` | The 32-char Item ID from step 2 |
| `CWS_CLIENT_ID` | OAuth Client ID from step 3 |
| `CWS_CLIENT_SECRET` | OAuth Client Secret from step 3 |
| `CWS_REFRESH_TOKEN` | Refresh token from step 3 |

These are encrypted and only exposed to the release job. **Never commit them.**

> Until these secrets exist, tagging a release still works — the pipeline creates
> the GitHub Release and simply skips the store-publish step with a notice.

---

## Cutting a release (every time)

1. During development, add a changeset for each user-facing change:
   ```bash
   npx changeset
   ```
2. When ready to release, bump the version and update the changelog:
   ```bash
   npm run version          # applies changesets → bumps package.json + CHANGELOG
   git commit -am "release: vX.Y.Z"
   ```
   (Use the version `npm run version` produced.)
3. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push --follow-tags
   ```
4. Watch the **Release** workflow in the Actions tab. It will:
   - verify (lint, typecheck, unit tests),
   - build and package the zip,
   - create a GitHub Release with the zip attached,
   - upload **and publish** the new version to the Chrome Web Store.

Store review for updates is usually faster than the first submission. You can
also publish manually any time:

```bash
npm run zip
EXTENSION_ID=… CLIENT_ID=… CLIENT_SECRET=… REFRESH_TOKEN=… \
  npx chrome-webstore-upload --source .output/css-overrides-*-chrome.zip
```

---

## Listing checklist

- [ ] **Privacy policy URL** — required. Host [PRIVACY.md](../PRIVACY.md) (e.g.
      the GitHub raw/Pages URL) and paste the link.
- [ ] **"No data collected"** declared in the Privacy practices form (it's true).
- [ ] **Permission justifications:**
  - `activeTab` — inject the user's CSS into the current tab on click.
  - `scripting` — the API that performs the injection.
  - `storage` / `unlimitedStorage` — store overrides locally.
  - `sidePanel` — host the editor UI.
  - `optional_host_permissions` — requested per-origin, on demand, only when a
    user applies to a site `activeTab` doesn't already cover.
- [ ] **Screenshots** of the side panel (1280×800 or 640×400).
- [ ] **Category** (e.g. Developer Tools) and a short + detailed description.

## Notes

- Minimal permissions → faster review. We intentionally avoid blanket host
  permissions.
- If you ever publish under a **group publisher**, also set a `PUBLISHER_ID`
  secret and pass `--publisher-id` (see the CLI docs); not needed for a personal
  account.
