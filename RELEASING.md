# Releasing

English | [中文](RELEASING.zh.md)

A release is one version number written in four places that must agree. The
`prepublishOnly` hook and the tag-triggered workflow both run
`scripts/verify-release.mjs`, which fails the release when they disagree.

| Place | Convention | Example |
|---|---|---|
| `package.json` `version` | plain semver, no `v` | `0.1.0` |
| git tag | `v` + that semver, annotated | `v0.1.0` |
| GitHub Release | created from that tag, notes generated from the commits | `v0.1.0` |
| `CHANGELOG.md` heading | `## [version] - YYYY-MM-DD` | `## [0.1.0] - 2026-09-12` |

## Tag rules

- Use annotated tags (`git tag -a`), never lightweight ones: the tag then carries
  the release message, the tagger and the date.
- Name the tag exactly `v<package.json version>`. `v0.1.0` and `0.1.0` are
  different tags; only the first one is correct here.
- Tags are immutable. Once a tag is pushed and its version is on npm, do not
  delete or move it — publish the next patch instead, so installs stay
  reproducible.
- Pre-releases keep the semver suffix, for example `v0.2.0-rc.1`, and go out
  under a different npm dist-tag: `npm publish --tag next`.

## Steps

```sh
# 1. refresh the packaged artifacts from a harness checkout that ran pnpm run build
scripts/sync-from-harness.sh /path/to/deepseek-harness

# 2. bump the version (this writes package.json only, no commit and no tag)
npm version --no-git-tag-version patch     # or minor / major

# 3. move the CHANGELOG "Unreleased" entries under the new version heading,
#    add today's date, and update the two comparison links at the bottom

# 4. prove the tarball installs the way a user installs it (needs the dsh CLI)
npm run verify:install

# 5. commit, tag, push — the tag push starts the release workflow
git add -A
git commit -m "release: v0.1.1"
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin main
git push origin v0.1.1
```

Pushing the tag runs `.github/workflows/release.yml`, which re-checks the version,
publishes to npm when that version is not on npm yet, and opens the GitHub
Release with generated notes. Both halves are idempotent, so re-running the
workflow never publishes the same version twice.

## Two-factor authentication

npm refuses to publish from an account without two-factor authentication:

```
E403 ... Two-factor authentication or granular access token with bypass 2fa
enabled is required to publish packages.
```

That is npm policy, not a problem with this repository. Turn on 2FA once, at
npmjs.com → Account → Two-Factor Authentication.

What `npm publish` then does depends on the method you enrolled:

- **Authenticator app**: it asks for a one-time code on stdin.
- **Security key or passkey**: it prints a `https://www.npmjs.com/auth/cli/...`
  link and waits. Open it, approve, and the CLI finishes by itself; the link is
  short-lived, so approve within a couple of minutes.

The interactive step disappears entirely once a granular token with **Bypass
2FA** is in `~/.npmrc`, or supplied as `NPM_TOKEN` in CI.

For releases without a human at the keyboard, create a granular access token
with **Bypass 2FA** enabled and read/write access to this package, and use it as
the `NPM_TOKEN` secret described below.

## Publishing by hand

When the workflow cannot publish — no `NPM_TOKEN` secret yet, or an npm outage —
the same version can go out from your machine:

```sh
npm publish                      # runs verify-release.mjs through prepublishOnly
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1           # the workflow sees the version on npm and only opens the Release
```

## Letting the workflow publish

Create a granular npm token with **Bypass 2FA** enabled and read and write access
to this package (npmjs.com → Access Tokens → Generate New Token → Granular
Access Token), then add it to the repository as the `NPM_TOKEN` secret
(Settings → Secrets and variables → Actions → New repository secret).

Until that secret exists, publish by hand and then push the tag: the workflow
sees the version on npm, skips the npm step, and only opens the Release. If the
version is missing from npm *and* the secret is unset, the workflow fails there
on purpose rather than leaving a tag with no artifact behind it.

As an alternative to a long-lived token, npm supports trusted publishing: link
this repository and the `release.yml` workflow on the package's npm settings
page, and the workflow authenticates with its OIDC identity instead of a secret.

## After the release

- Check the package page renders the README: <https://www.npmjs.com/package/@ctl456/dsh-skills-manager>.
- Check the GitHub Release exists and points at the tag.
- Verify an install the way a user does it:

  ```sh
  dsh plugin --profile web add @ctl456/dsh-skills-manager@latest
  ```
