#!/usr/bin/env node
//
// Gate a release: the package version, the git tag and the changelog have to
// agree before anything reaches npm. Runs as `prepublishOnly` for a manual
// `npm publish` and as the first step of the tag-triggered GitHub workflow.
//
// Environment:
//   GITHUB_REF_TYPE / GITHUB_REF_NAME - set by GitHub Actions; when the ref is
//   a tag, the tag must be exactly `v<version>` or the check fails.
//
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const { name, version } = pkg
const tag = `v${version}`
const problems = []
const notes = []

/** Run a git command, returning undefined when git is unavailable or the command exits non-zero. */
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  problems.push(`package.json version '${version}' is not a plain semver string`)
}

const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
if (!new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(changelog)) {
  problems.push(`CHANGELOG.md has no '## [${version}]' section`)
}

for (const artifact of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml']) {
  try {
    readFileSync(join(root, artifact))
  } catch {
    problems.push(`${artifact} is missing — run scripts/sync-from-harness.sh first`)
  }
}

const refType = process.env.GITHUB_REF_TYPE
const refName = process.env.GITHUB_REF_NAME
if (refType === 'tag' && refName !== tag) {
  problems.push(`the pushed tag is '${refName}' but package.json says '${version}' (expected '${tag}')`)
}

const head = git('rev-parse', 'HEAD')
const tagCommit = git('rev-parse', `refs/tags/${tag}^{commit}`)
if (head && tagCommit) {
  if (tagCommit !== head) {
    notes.push(`tag ${tag} already exists and does not point at HEAD (${tagCommit.slice(0, 8)} vs ${head.slice(0, 8)})`)
  } else {
    notes.push(`tag ${tag} points at HEAD`)
  }
} else if (refType !== 'tag') {
  notes.push(`tag ${tag} does not exist yet — create it with: git tag -a ${tag} -m "Release ${tag}"`)
}

if (git('status', '--porcelain')) {
  notes.push('the working tree has uncommitted changes')
}

for (const note of notes) console.log(`verify-release: note: ${note}`)

if (problems.length > 0) {
  for (const problem of problems) console.error(`verify-release: ${problem}`)
  process.exit(1)
}

console.log(`verify-release: OK — ${name}@${version} is ready to release as ${tag}`)
