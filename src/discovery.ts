/**
 * Turn a repository's file list into the skills it contains.
 *
 * Repositories do not agree on where a skill lives, and the shipped filesystem
 * provider only understands `<name>/SKILL.md` and `<name>.md`. The survey that
 * drove this module found, among sixteen popular skill repositories, all of:
 *
 *   - the whole repository is one skill (`SKILL.md` at the root, with the
 *     `references/`, `scripts/` and `templates/` it names beside it);
 *   - a container directory holds many (`skills/<name>/SKILL.md`);
 *   - each top-level directory is one (`<name>/SKILL.md`);
 *   - an agent-specific nest holds them (`plugins/<p>/skills/<name>/SKILL.md`,
 *     `.claude/skills/<name>/SKILL.md`);
 *   - a repository vendors copies of other skill repositories under a
 *     materials directory, so the same skill name appears more than once.
 *
 * Discovery is therefore a pure function of the blob list: find every
 * `SKILL.md`, decide which directory owns it, hand it the files below that
 * directory that no nested skill owns, and finally drop duplicate skill names
 * in favour of the copy closest to the repository root — the canonical one,
 * not a vendored or translated snapshot.
 *
 * This module never touches the network, so the layout rules are testable
 * against recorded trees.
 *
 * @module @ctl456/dsh-skills-manager/discovery
 */

/** One blob in a repository tree. */
export interface RepoBlob {
  /** Repository-relative path, always `/`-separated. */
  readonly path: string
  /** Size in bytes as the tree API reported it. */
  readonly size: number
}

/** Where a skill's directory sits relative to the repository root. */
export type SkillLayout =
  /** `SKILL.md` at the repository root: the repository is the skill. */
  | 'repository'
  /** `skills/<name>/SKILL.md`, the common multi-skill container. */
  | 'container'
  /** `<name>/SKILL.md` directly under the root. */
  | 'collection'
  /** Deeper, typically an agent-specific convention such as `plugins/**` or `.claude/skills/**`. */
  | 'nested'

/** One skill found in a repository, before its `SKILL.md` is fetched. */
export interface DiscoveredSkill {
  /** Directory holding the `SKILL.md`, repository-relative; empty for a root skill. */
  readonly directory: string
  /** Repository-relative path of the `SKILL.md` itself. */
  readonly skillFile: string
  /** Provisional name from the directory basename; the frontmatter name wins once fetched. */
  readonly slug: string
  /** Which layout bucket the directory fell into. */
  readonly layout: SkillLayout
  /** Files to download for this skill, excluding files a nested skill owns. */
  readonly files: readonly RepoBlob[]
  /** Total bytes of {@link files}. */
  readonly bytes: number
  /** Files dropped by a limit, so the card can warn that the copy is partial. */
  readonly dropped: number
  /**
   * Whether the directory looks like someone else's vendored snapshot — an
   * unpacked `<repo>-main/` archive under a materials directory. Such a copy
   * still imports, but the card labels it so a user picking between two rows
   * with the same name can see which is canonical.
   */
  readonly vendored: boolean
}

/** Caps that keep one import from pulling a whole monorepo. */
export interface DiscoveryLimits {
  /** Largest single file to include. */
  readonly maxFileBytes: number
  /** Largest total payload for one skill. */
  readonly maxSkillBytes: number
  /** Largest number of files for one skill. */
  readonly maxFiles: number
}

/** Default caps: generous for real skills, far below a monorepo's weight. */
export const DEFAULT_LIMITS: DiscoveryLimits = {
  maxFileBytes: 2 * 1024 * 1024,
  maxSkillBytes: 24 * 1024 * 1024,
  maxFiles: 400,
}

/**
 * Path segments that never carry skill instructions or resources, so an import
 * skips them instead of spending its budget on them.
 */
const NOISE_SEGMENTS = new Set([
  '.git', '.github', 'node_modules', '__pycache__', '.venv', 'venv',
  '.mypy_cache', '.pytest_cache', '.ruff_cache', '.tox', '.idea', '.vscode',
])

/** Files that are repository furniture rather than skill content. */
const NOISE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.editorconfig', '.gitattributes', '.gitignore',
  'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'GIT_COMMIT_CHECKLIST.md',
])

/**
 * Path segments that mark a directory as somebody else's vendored snapshot, so
 * a duplicate skill name prefers the copy outside them.
 */
const VENDOR_MARKERS = new Set([
  'vendor', 'vendors', 'third_party', 'third-party', 'external', 'archived',
  '资料', '参考资料', '项目资料',
])

/** A trailing `-main` / `-master` directory is an unpacked archive of another repository. */
const VENDOR_SUFFIX = /-(?:main|master)$/

/**
 * Whether a path is furniture the importer should ignore.
 * @param path - repository-relative path.
 * @returns true when no skill content lives at that path.
 */
export function isNoisePath(path: string): boolean {
  const segments = path.split('/')
  const base = segments.at(-1) ?? ''
  if (NOISE_FILES.has(base)) return true
  return segments.some(segment => NOISE_SEGMENTS.has(segment))
}

/**
 * Enumerate the skills in a repository tree.
 * @param blobs - every blob the tree API returned.
 * @param options - the user's scoped subpath and the payload caps.
 * @returns the skills to offer, ordered by directory.
 */
export function discoverSkills(
  blobs: readonly RepoBlob[],
  options: { readonly subpath?: string; readonly limits?: DiscoveryLimits } = {},
): DiscoveredSkill[] {
  const limits = options.limits ?? DEFAULT_LIMITS
  const scope = normalizeSubpath(options.subpath)
  // Scoping filters, it does not rebase: every path stays repository-relative
  // so the same string can be fetched back from the raw host and recorded as
  // provenance. A `/tree/main/skills/x` URL therefore yields one skill whose
  // directory is `skills/x`, not one whose directory is the empty root.
  const scoped: RepoBlob[] = []
  for (const blob of blobs) {
    if (!inScope(blob.path, scope) || isNoisePath(blob.path)) continue
    scoped.push(blob)
  }
  const skillFiles = scoped.filter(blob => isSkillFile(blob.path)).map(blob => blob.path)
  const directories = [...new Set(skillFiles.map(path => dirname(path)))].sort(compareDirectories)
  const owned = directories.map(directory => new Set(directories.filter(other => other !== directory)))
  return directories.map((directory, index) => {
    const files = scoped.filter(blob => belongsTo(blob, directory, owned[index]!))
    return collect(directory, files, limits)
  })
}

/**
 * Keep one skill per name, preferring the copy closest to the repository root.
 *
 * A duplicate is normally a vendored snapshot or a translation of the same
 * skill; the canonical copy is the shallowest one, and a copy under a
 * materials or vendor directory loses to one that is not, however deep it sits.
 * @param skills - discovered skills with their resolved names.
 * @returns the survivors, in their original order.
 */
export function dedupeByName<T extends { readonly name: string; readonly directory: string }>(
  skills: readonly T[],
): { readonly kept: T[]; readonly dropped: T[] } {
  const best = new Map<string, T>()
  for (const skill of skills) {
    const current = best.get(skill.name)
    if (current === undefined || prefers(skill, current)) best.set(skill.name, skill)
  }
  const kept: T[] = []
  const dropped: T[] = []
  for (const skill of skills) {
    if (best.get(skill.name) === skill) kept.push(skill)
    else dropped.push(skill)
  }
  return { kept, dropped }
}

/** Whether the candidate beats the incumbent as the canonical copy. */
function prefers<T extends { readonly directory: string }>(candidate: T, incumbent: T): boolean {
  const candidateVendored = isVendored(candidate.directory)
  const incumbentVendored = isVendored(incumbent.directory)
  if (candidateVendored !== incumbentVendored) return !candidateVendored
  const candidateDepth = depth(candidate.directory)
  const incumbentDepth = depth(incumbent.directory)
  if (candidateDepth !== incumbentDepth) return candidateDepth < incumbentDepth
  return candidate.directory < incumbent.directory
}

/** Whether any segment of a directory marks it as a vendored snapshot. */
function isVendored(directory: string): boolean {
  return directory.split('/').some(segment => VENDOR_MARKERS.has(segment) || VENDOR_SUFFIX.test(segment))
}

/** Number of path segments, ignoring the empty root. */
function depth(directory: string): number {
  return directory.length === 0 ? 0 : directory.split('/').length
}

/** Assemble one skill from the files it owns, applying the caps. */
function collect(directory: string, files: readonly RepoBlob[], limits: DiscoveryLimits): DiscoveredSkill {
  const sorted = [...files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  const keptFiles: RepoBlob[] = []
  let bytes = 0
  let dropped = 0
  for (const file of sorted) {
    if (file.size > limits.maxFileBytes || keptFiles.length >= limits.maxFiles || bytes + file.size > limits.maxSkillBytes) {
      dropped += 1
      continue
    }
    keptFiles.push(file)
    bytes += file.size
  }
  return {
    directory,
    skillFile: directory.length === 0 ? 'SKILL.md' : `${directory}/SKILL.md`,
    slug: slugOf(directory),
    layout: layoutOf(directory),
    files: keptFiles,
    bytes,
    dropped,
    vendored: isVendored(directory),
  }
}

/**
 * Classify a skill directory into the layout taxonomy.
 *
 * The test is path-shaped, not content-shaped: a `skills/<name>` parent is the
 * documented container convention whether the skill keeps one file or fifty,
 * and anything deeper is a host-specific nest that we still import but label
 * so the card can explain why a repository surfaced an unexpected name.
 * @param directory - the skill directory, repository-relative.
 * @returns which bucket the directory fell into.
 */
function layoutOf(directory: string): SkillLayout {
  if (directory.length === 0) return 'repository'
  const segments = directory.split('/')
  if (segments.length === 1) return 'collection'
  if (segments.at(-2) === 'skills') return 'container'
  return 'nested'
}

/** Whether a file sits under a skill directory and no nested skill directory. */
function belongsTo(blob: RepoBlob, directory: string, otherSkills: ReadonlySet<string>): boolean {
  if (!under(blob.path, directory)) return false
  for (const other of otherSkills) {
    if (other.length > directory.length && under(blob.path, other)) return false
  }
  return true
}

/** Whether a path equals a directory or sits below it. */
function under(path: string, directory: string): boolean {
  if (directory.length === 0) return true
  return path === directory || path.startsWith(`${directory}/`)
}

/** The directory part of a repository-relative path. */
function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index < 0 ? '' : path.slice(0, index)
}

/** Whether a path names a skill instruction file. */
function isSkillFile(path: string): boolean {
  return (path.split('/').at(-1) ?? '').toLowerCase() === 'skill.md'
}

/** The provisional skill name: the directory's own name, or the repository root. */
function slugOf(directory: string): string {
  if (directory.length === 0) return ''
  return directory.split('/').at(-1) ?? ''
}

/** Order skill directories so a root skill comes first, then shallow ones. */
function compareDirectories(left: string, right: string): number {
  const depthDelta = depth(left) - depth(right)
  if (depthDelta !== 0) return depthDelta
  return left < right ? -1 : left > right ? 1 : 0
}

/** Normalize a user-scoped subpath for prefix comparison. */
function normalizeSubpath(subpath: string | undefined): string {
  if (subpath === undefined) return ''
  return subpath.replace(/^\/+|\/+$/g, '')
}

/** Whether a path falls inside the user's scoped subpath. */
function inScope(path: string, scope: string): boolean {
  if (scope.length === 0) return true
  return path === scope || path.startsWith(`${scope}/`)
}
