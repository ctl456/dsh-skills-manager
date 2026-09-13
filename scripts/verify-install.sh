#!/usr/bin/env bash
#
# Prove that the packed tarball installs into a fresh dsh profile and composes
# its Profile row — the check that separates "works from a checkout with
# `link:`" from "works the way a user installs it".
#
# Requires the `dsh` CLI on PATH (override with DSH_BIN=/path/to/dsh) and network
# access for the peer packages.
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$here"

dsh_bin="${DSH_BIN:-dsh}"
profile="${PROFILE:-skills-manager-check}"
name="$(node -p "require('./package.json').name")"
version="$(node -p "require('./package.json').version")"

if ! command -v "$dsh_bin" >/dev/null 2>&1 && [ ! -x "$dsh_bin" ]; then
  echo "verify-install: '$dsh_bin' is not executable — install the dsh CLI or set DSH_BIN" >&2
  exit 2
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
export DSH_HOME="$work/home"

echo "== packing $name@$version =="
pack_dir="$work/pack"
mkdir -p "$pack_dir"
npm pack --pack-destination "$pack_dir" --silent >/dev/null
tarball="$(find "$pack_dir" -name '*.tgz' | head -n1)"
if [ -z "$tarball" ]; then
  echo "verify-install: npm pack produced no tarball" >&2
  exit 1
fi

echo "== tarball payload =="
# Read the listing once: piping tar into `grep -q` under `set -o pipefail` races
# with tar's SIGPIPE when grep exits on the first match.
listing="$(tar -tzf "$tarball")"
printf '%s\n' "$listing" | sort
for required in package/cordis.patch.yml package/lib/index.js package/lib/client.js; do
  if ! grep -qxF "$required" <<<"$listing"; then
    echo "verify-install: tarball is missing $required" >&2
    exit 1
  fi
done
if ! grep -qE '^package/lib/types/.*\.d\.ts$' <<<"$listing"; then
  echo "verify-install: tarball carries no declaration files" >&2
  exit 1
fi

echo "== installing into a throwaway profile ($profile) =="
"$dsh_bin" plugin --profile "$profile" add "file:$tarball"
grep -q "\"$name\"" "$DSH_HOME/profiles/$profile/package.json" || {
  echo "verify-install: the profile manifest does not depend on $name" >&2
  exit 1
}

echo "== composing the profile tree =="
dump="$("$dsh_bin" --profile "$profile" --dump-config)"
grep -q 'id: skills-manager' <<<"$dump" || {
  echo "verify-install: the composed tree has no skills-manager row; dump follows" >&2
  echo "$dump" >&2
  exit 1
}
grep -q "$name" <<<"$dump" || {
  echo "verify-install: the composed row does not name $name; dump follows" >&2
  echo "$dump" >&2
  exit 1
}

echo
echo "verify-install: OK — $name@$version packs, installs into a fresh profile, and composes its row"
echo "for the Web UI check, boot it and open Settings -> Skills:"
echo "  DSH_HOME=$DSH_HOME $dsh_bin --profile $profile"
