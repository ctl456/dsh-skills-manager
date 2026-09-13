# Harness-side integration patch

`dsh-skills-manager` is built inside a DeepSeek Harness checkout — see
[Rebuilding the bundled artifacts](../../README.md#rebuilding-the-bundled-artifacts).
The manager package and the wiring it needs are not part of upstream DeepSeek
Harness, so `scripts/sync-from-harness.sh` needs a harness checkout that already
carries them.

[`manager-plugins-worktree.patch`](manager-plugins-worktree.patch) captures that
checkout state as one `git apply`-able patch, taken from the working tree the
published artifact was built from.

## What it contains

- `packages/skill/skills-manager/` — this package's upstream source, tests and
  build config.
- The wiring that makes it buildable and loadable: `tsconfig.base/client/host`,
  `apps/cli/package.json`, `pnpm-lock.yaml`, `scripts/gen-tool-catalog.ts`,
  `scripts/package-dependency-policy.ts`, and the generated client slot catalog.
- The documentation surface: the package README, the skill-group README, the
  user guide page with its screenshots, the feature Agent Note, and the
  generated tool, config and module catalogs.
- A CLI overlay example at `apps/cli/config/examples/skills-manager/`.

It also carries the sibling `@deepseek-ai/dsh-mcp-manager` plugin. The two
managers share several files — `tsconfig.*`, `apps/cli/package.json`,
`scripts/gen-tool-catalog.ts`, `scripts/package-dependency-policy.ts` and the
generated catalogs — and those hunks cannot be split without breaking the patch,
so applying it installs both managers.

## Apply it

```sh
# run this first from a checkout of this repository, which records the base commit
commit="$(sed -n 's/^- Harness commit: `\(.*\)`$/\1/p' PROVENANCE.md)"

git clone https://github.com/deepseek-ai/deepseek-harness
cd deepseek-harness
git checkout "$commit"
git apply /path/to/dsh-skills-manager/docs/harness/manager-plugins-worktree.patch
pnpm install
pnpm run build
```

Then sync the built artifacts back into this repository:

```sh
cd /path/to/dsh-skills-manager
scripts/sync-from-harness.sh /path/to/deepseek-harness
```

## Notes

- The patch was checked with `git apply --check` against the same upstream
  commit it was taken from, and applies cleanly.
- Build output and `node_modules` are not in the patch; `pnpm install` and
  `pnpm run build` produce them.
- `docs/` is not part of the published npm tarball, so this patch does not
  change what `npm install @ctl456/dsh-skills-manager` downloads.
