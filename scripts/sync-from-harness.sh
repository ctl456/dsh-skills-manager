#!/usr/bin/env bash
#
# Refresh the packaged artifacts and sources from a built deepseek-harness
# checkout, then re-apply this repository's own package name.
#
# The upstream build chain is workspace-coupled (the host bundle comes from the
# repository-root tsdown config plus the Typert codegen plugin, and the browser
# bundle from packages/client/tsdown.client.ts), so building inside a harness
# checkout and syncing the output is the supported path.
#
# Usage: scripts/sync-from-harness.sh /path/to/deepseek-harness
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

harness="${1:-${HARNESS_DIR:-}}"
if [ -z "$harness" ]; then
  echo "usage: scripts/sync-from-harness.sh /path/to/deepseek-harness" >&2
  exit 2
fi
upstream_package="$harness/packages/skill/skills-manager"
if [ ! -f "$upstream_package/lib/index.js" ] || [ ! -f "$upstream_package/lib/client.js" ]; then
  echo "sync-from-harness: $upstream_package is not built — run 'pnpm run build' in the harness checkout first" >&2
  exit 1
fi

name="$(node -p "require('$here/package.json').name")"
version="$(node -p "require('$here/package.json').version")"

echo "== copying artifacts from $upstream_package =="
rm -rf lib src
mkdir -p lib/types
cp "$upstream_package/lib/index.js" lib/index.js
cp "$upstream_package/lib/client.js" lib/client.js
cp -r "$upstream_package/lib/types/." lib/types/
find lib/types -type f ! -name '*.d.ts' -delete
cp -r "$upstream_package/src/." src/
cp "$upstream_package/cordis.patch.yml" cordis.patch.yml

echo "== re-applying local package name $name =="
node scripts/set-package-name.mjs "$name" --from "@deepseek-ai/dsh-skills-manager"

harness_version="$(node -p "require('$harness/package.json').version")"
harness_commit="$(git -C "$harness" rev-parse HEAD 2>/dev/null || echo unknown)"
cat > PROVENANCE.md <<EOF
# Provenance

- Local package: \`$name@$version\`
- Built from: \`deepseek-ai/deepseek-harness\` \`packages/skill/skills-manager\`
- Harness version: \`$harness_version\`
- Harness commit: \`$harness_commit\`
- Synced at: $(date -u +%Y-%m-%dT%H:%M:%SZ)

\`lib/index.js\`, \`lib/client.js\`, \`lib/types/**/*.d.ts\`, \`src/**\` and \`cordis.patch.yml\`
are copies of the upstream package at that commit, with the package name
rewritten by \`scripts/set-package-name.mjs\`. Everything else in this repository
is maintained here.
EOF

echo "== done =="
cat PROVENANCE.md
echo
echo "next: npm run verify:install"
