# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

For user-facing changes, add a changeset describing the change:

```bash
npx changeset
```

Pick the appropriate semver bump (patch/minor/major) and write a short,
user-readable summary. The accumulated changesets are consumed at release time
to bump the version and update `CHANGELOG.md`.
