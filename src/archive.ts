/**
 * Read a downloaded skill archive.
 *
 * A `.zip` is the second way a skill reaches the manager: people package a
 * skill directory, or an agent host exports one, and there is no repository to
 * walk. Unpacking happens in memory and produces the same `RepoBlob` shape the
 * GitHub tree reader produces, so one discovery pass serves both sources and a
 * skill behaves identically however it arrived.
 *
 * An archive is untrusted input, so the reader refuses rather than repairs:
 * directories, macOS resource forks and the usual editor noise are dropped
 * before decompression, entry count and total size are capped so a zip bomb
 * cannot exhaust the host, and a single wrapping folder — what GitHub's own
 * "Download ZIP" adds — is stripped so a packaged repository keeps the layout
 * its author wrote.
 *
 * @module @ctl456/dsh-skills-manager/archive
 */

import { unzipSync } from 'fflate'
import { isNoisePath, type RepoBlob } from './discovery.ts'

/** One readable file inside an archive. */
export interface ArchiveEntry {
  /** Archive-relative path with any single wrapping folder removed. */
  readonly path: string
  /** Uncompressed size in bytes. */
  readonly size: number
  /** Uncompressed bytes, kept in memory for the install that follows. */
  readonly data: Uint8Array
}

/** Ceilings that keep a hostile archive from exhausting the host. */
export interface ArchiveLimits {
  /** Largest number of files to keep. */
  readonly maxEntries: number
  /** Largest total uncompressed payload to keep. */
  readonly maxTotalBytes: number
}

/** Default ceilings: generous for real skills, small next to a zip bomb. */
export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxEntries: 5_000,
  maxTotalBytes: 128 * 1024 * 1024,
}

/** Why an archive could not be read as a skill source. */
export type ArchiveProblem =
  /** The bytes are not a readable zip. */
  | 'unreadable'
  /** The archive held no usable files. */
  | 'empty'
  /** The archive exceeded an {@link ArchiveLimits} ceiling, so it was refused whole. */
  | 'too-large'

/** The outcome of reading an archive. */
export type ArchiveResult =
  | {
    readonly ok: true
    readonly entries: readonly ArchiveEntry[]
    /** The wrapping folder that was stripped, empty when there was none. */
    readonly root: string
    /** Files skipped by an {@link ArchiveLimits} ceiling or by noise filtering. */
    readonly dropped: number
  }
  | { readonly ok: false; readonly problem: ArchiveProblem }

/**
 * Unpack a zip archive into the repository-shaped entries discovery consumes.
 * @param bytes - the archive's bytes, as downloaded or read from disk.
 * @param limits - the ceilings to enforce; defaults to {@link DEFAULT_ARCHIVE_LIMITS}.
 * @returns the usable entries and the stripped root, or why the archive was refused.
 */
export function readArchive(bytes: Uint8Array, limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS): ArchiveResult {
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(bytes, {
      // Filtering before decompression means a rejected entry costs no memory,
      // and it is the only place the declared size of a skipped entry is known.
      filter: (file) => !file.name.endsWith('/') && !isArchiveNoise(file.name),
    })
  } catch {
    return { ok: false, problem: 'unreadable' }
  }
  const paths = Object.keys(unzipped)
  if (paths.length === 0) return { ok: false, problem: 'empty' }
  const root = wrappingRoot(paths)
  const entries: ArchiveEntry[] = []
  let dropped = 0
  let total = 0
  for (const path of paths) {
    const data = unzipped[path]!
    if (entries.length >= limits.maxEntries) {
      dropped += 1
      continue
    }
    total += data.byteLength
    if (total > limits.maxTotalBytes) return { ok: false, problem: 'too-large' }
    const relative = root.length === 0 ? path : path.slice(root.length + 1)
    if (relative.length === 0) continue
    entries.push({ path: relative, size: data.byteLength, data })
  }
  if (entries.length === 0) return { ok: false, problem: 'empty' }
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  return { ok: true, entries, root, dropped }
}

/**
 * Project archive entries onto the blob shape a tree walk produces.
 * @param entries - the entries {@link readArchive} returned.
 * @returns one blob per entry, carrying its uncompressed size.
 */
export function archiveBlobs(entries: readonly ArchiveEntry[]): RepoBlob[] {
  return entries.map(entry => ({ path: entry.path, size: entry.size }))
}

/** Paths an archive carries that are never skill content. */
function isArchiveNoise(path: string): boolean {
  // Archive paths may use backslashes when a Windows tool wrote them.
  const normalized = path.replace(/\\/g, '/')
  if (normalized.startsWith('__MACOSX/')) return true
  if (normalized.split('/').some(segment => segment.startsWith('._'))) return true
  return isNoisePath(normalized)
}

/**
 * The single folder an archive wraps its content in, if it has one.
 *
 * A GitHub "Download ZIP" puts everything under `<repo>-<ref>/`, so without
 * this the layout would be read as a container of exactly one oddly named
 * directory. Stripping only when every entry shares one first segment keeps an
 * archive that deliberately starts with `skills/` from being flattened.
 * @param paths - every kept path in the archive.
 * @returns the prefix to strip, without a trailing slash; empty when there is none.
 */
function wrappingRoot(paths: readonly string[]): string {
  const first = paths[0]!
  const slash = first.indexOf('/')
  if (slash <= 0) return ''
  const candidate = first.slice(0, slash)
  for (const path of paths) {
    if (!path.startsWith(`${candidate}/`)) return ''
  }
  return candidate
}
