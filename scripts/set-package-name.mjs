#!/usr/bin/env node
/**
 * Rewrite this package's name everywhere it is load-bearing.
 *
 * Three places must agree at runtime, because the client module system serves
 * `/plugins/<entry id>/client.js` and rejects a bundle whose
 * `window.__ModuleLoader__.load({ id })` registers anything else:
 *
 *   1. package.json  — the npm identity.
 *   2. cordis.patch.yml — the `name:` of the Profile row the harness mounts.
 *   3. lib/client.js — the bundle registration id (and the CSS tag identity
 *      derived from it).
 *
 * Host-bundle and declaration comments are rewritten too so the tree stays
 * self-consistent.
 *
 * Usage:
 *   node scripts/set-package-name.mjs <new-name> [--from <old-name>] [--dry-run]
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const NAME_PATTERN = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
/** Directories whose text files may carry the package name. */
const SCAN_ROOTS = ['lib', 'src', 'scripts']
/** Individual files that carry the package name. */
const SCAN_FILES = ['package.json', 'cordis.patch.yml', 'README.md', 'README.zh.md']
/** Extensions worth reading as text. */
const TEXT_EXTENSIONS = ['.js', '.mjs', '.ts', '.tsx', '.css', '.yml', '.yaml', '.json', '.md']

function fail(message) {
  process.stderr.write(`set-package-name: ${message}\n`)
  process.exit(2)
}

function parseArgs(argv) {
  const positional = []
  let from
  let dryRun = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') dryRun = true
    else if (argument === '--from') {
      from = argv[index + 1]
      index += 1
      if (from === undefined) fail('--from needs a package name')
    } else positional.push(argument)
  }
  if (positional.length !== 1) {
    fail('usage: set-package-name.mjs <new-name> [--from <old-name>] [--dry-run]')
  }
  return { next: positional[0], from, dryRun }
}

function walk(directory, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walk(path, found)
    else if (TEXT_EXTENSIONS.includes(entry.name.slice(entry.name.lastIndexOf('.')))) found.push(path)
  }
  return found
}

function main() {
  const { next, from, dryRun } = parseArgs(process.argv.slice(2))
  if (!NAME_PATTERN.test(next)) fail(`not a valid npm package name: ${next}`)

  const manifestPath = join(ROOT, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const previous = from ?? manifest.name
  if (!NAME_PATTERN.test(previous)) fail(`not a valid npm package name: ${previous}`)
  if (previous === next) {
    process.stdout.write(`set-package-name: already named ${next}\n`)
    return
  }

  const targets = [
    ...SCAN_FILES.map(file => join(ROOT, file)),
    ...SCAN_ROOTS.flatMap(root => walk(join(ROOT, root))),
  ].filter(path => {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  })

  const changed = []
  let occurrences = 0
  for (const path of targets) {
    const text = readFileSync(path, 'utf8')
    if (!text.includes(previous)) continue
    const hits = text.split(previous).length - 1
    occurrences += hits
    changed.push(`${relative(ROOT, path).replaceAll('\\', '/')} (${hits})`)
    if (!dryRun) writeFileSync(path, text.split(previous).join(next))
  }

  const verb = dryRun ? 'would rewrite' : 'rewrote'
  process.stdout.write(`set-package-name: ${verb} ${occurrences} occurrence(s) in ${changed.length} file(s)\n`)
  for (const line of changed) process.stdout.write(`  ${line}\n`)
  process.stdout.write(`set-package-name: ${previous} -> ${next}\n`)
  if (!dryRun) {
    process.stdout.write('set-package-name: now re-run `npm run verify:install` against the new name\n')
  }
}

main()
