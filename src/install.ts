/**
 * Write an imported skill's files beside its body.
 *
 * A managed skill keeps its instructions in the settings document, but the
 * `references/`, `scripts/` and `assets/` those instructions name have to exist
 * on disk for the model to resolve them, so an import materialises them under
 * one directory per skill. Everything here treats the repository as untrusted:
 * target paths are re-derived from the skill's own directory, any path that
 * escapes it is refused rather than sanitised, and a re-install clears the old
 * directory so a file the upstream repository deleted cannot linger and shadow
 * a stale instruction.
 *
 * The filesystem is injected so the whole module is testable without touching
 * a real disk.
 *
 * @module @ctl456/dsh-skills-manager/install
 */

import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { DiscoveredSkill, RepoBlob } from './discovery.ts'
import type { InstalledFiles } from './skills.ts'

/** The filesystem operations an install needs. `node:fs/promises` satisfies it. */
export interface InstallFs {
  /** Create a directory, parents included. */
  mkdir(path: string, options: { recursive: true }): Promise<string | undefined>
  /** Write one file, replacing any existing content. */
  writeFile(path: string, data: Uint8Array): Promise<void>
  /** Remove a directory and everything below it; a missing path is not an error. */
  rm(path: string, options: { recursive: true; force: true }): Promise<void>
}

/** One file to fetch from the source and write below the skill directory. */
export interface InstallFile {
  /** Repository-relative path to read. */
  readonly source: string
  /** Path to write, relative to the skill's own directory. */
  readonly target: string
  /** Size as the tree reported it, used for the written total. */
  readonly size: number
}

/** Why an install could not be staged. */
export type InstallProblem =
  /** The skill name would not produce a directory this installer owns. */
  | 'unsafe-name'
  /** A file's path would land outside the skill's directory. */
  | 'unsafe-path'

/** The outcome of staging an install. */
export type InstallPlanResult =
  | { readonly ok: true; readonly files: readonly InstallFile[] }
  | { readonly ok: false; readonly problem: InstallProblem }

/**
 * Resolve the absolute directory one skill's files live in.
 * @param root - the absolute root holding every imported skill.
 * @param name - the skill name, which is also the directory name.
 * @returns the absolute directory, or undefined when the name is unusable.
 */
export function skillDirectory(root: string, name: string): string | undefined {
  // A skill name is the only user-influenced segment of the path, so it is the
  // only place a separator or a traversal could enter.
  if (name.length === 0 || name === '.' || name === '..') return undefined
  if (isAbsolute(name) || name.includes('/') || name.includes('\\')) return undefined
  const directory = resolve(root, name)
  if (directory !== join(resolve(root), name)) return undefined
  if (!directory.startsWith(resolve(root) + sep)) return undefined
  return directory
}

/**
 * Derive the files to write for one discovered skill.
 *
 * Each target is the file's path below the skill's own directory, so a skill at
 * `skills/x` writes `SKILL.md` and `scripts/a.js` rather than reproducing
 * `skills/x/scripts/a.js`. That keeps a repository's layout out of the managed
 * root and keeps a relocated skill's internal relative paths correct.
 * @param skill - the discovered skill, whose directory is repository-relative.
 * @returns the staged files, or the first reason the plan is unsafe.
 */
export function planInstall(skill: DiscoveredSkill): InstallPlanResult {
  const files: InstallFile[] = []
  for (const blob of skill.files) {
    const target = targetOf(blob, skill.directory)
    if (target === undefined) return { ok: false, problem: 'unsafe-path' }
    files.push({ source: blob.path, target, size: blob.size })
  }
  return { ok: true, files }
}

/** Strip the skill directory prefix and refuse anything that escapes it. */
function targetOf(blob: RepoBlob, directory: string): string | undefined {
  const path = blob.path
  if (isAbsolute(path)) return undefined
  const target = directory.length === 0 ? path : relative(directory, path)
  if (target.length === 0 || target === '.') return undefined
  if (isAbsolute(target)) return undefined
  const segments = target.split(/[\\/]/)
  if (segments.some(segment => segment === '..' || segment === '' || segment === '.')) return undefined
  return segments.join('/')
}

/**
 * Write one skill's files, replacing whatever the previous install left.
 * @param options - the managed root, the skill, its staged files, how to read a source file, and the filesystem.
 * @returns what was written, for the settings document.
 * @throws Error when the skill name or a staged path is unsafe.
 */
export async function installSkillFiles(options: {
  readonly root: string
  readonly name: string
  readonly files: readonly InstallFile[]
  readonly read: (source: string) => Promise<Uint8Array>
  readonly fs: InstallFs
}): Promise<InstalledFiles> {
  const directory = skillDirectory(options.root, options.name)
  if (directory === undefined) throw new Error(`unsafe skill directory for "${options.name}"`)
  // Clear first: a file the upstream repository deleted must not survive, and a
  // half-written tree from an interrupted install must not be mixed with a new one.
  await options.fs.rm(directory, { recursive: true, force: true })
  await options.fs.mkdir(directory, { recursive: true })
  let bytes = 0
  let files = 0
  for (const file of options.files) {
    const target = resolve(directory, file.target)
    if (!target.startsWith(directory + sep)) throw new Error(`unsafe install path "${file.target}"`)
    const parent = resolve(target, '..')
    if (parent !== directory) await options.fs.mkdir(parent, { recursive: true })
    const data = await options.read(file.source)
    await options.fs.writeFile(target, data)
    bytes += data.byteLength
    files += 1
  }
  return { directory: options.name, files, bytes, dropped: 0 }
}

/**
 * Delete one skill's files.
 *
 * A skill's settings entry and its files are removed separately, so this is
 * deliberately forgiving: a directory that is already gone is the common case
 * for a hand-written skill and must not fail the removal.
 * @param options - the managed root, the skill name, and the filesystem.
 * @returns whether a directory was removed.
 */
export async function removeSkillFiles(options: {
  readonly root: string
  readonly name: string
  readonly fs: InstallFs
}): Promise<boolean> {
  const directory = skillDirectory(options.root, options.name)
  if (directory === undefined) return false
  await options.fs.rm(directory, { recursive: true, force: true })
  return true
}
