/**
 * Turn "somewhere a skill lives" into registry entries.
 *
 * Three things have to agree for an import to work: what the user pointed at
 * (a repository URL or a downloaded archive), which directories in it are
 * skills (that is {@link ./discovery.ts}), and what each one calls itself (that
 * is the `SKILL.md` frontmatter, which the repository layout cannot be trusted
 * to reflect). This module joins them and is the only place that knows both a
 * GitHub tree and a zip end up in the same shape.
 *
 * Listing and installing are separate calls on purpose. Listing is what the
 * card shows before anything is written — the real name, the description, how
 * many files and bytes would land on disk — and installing re-reads the source
 * rather than trusting a listing that a caller could have edited.
 *
 * @module @ctl456/dsh-skills-manager/source
 */

import { archiveBlobs, readArchive, type ArchiveLimits, type ArchiveProblem } from './archive.ts'
import { dedupeByName, discoverSkills, DEFAULT_LIMITS, type DiscoveredSkill, type DiscoveryLimits, type RepoBlob, type SkillLayout } from './discovery.ts'
import { parseSkillDocument, type SkillDocument } from './frontmatter.ts'
import { GitHubError, readBinaryFile, readTextFile, resolveTree, type GitHubClient, type GitHubProblem } from './github.ts'
import { installSkillFiles, planInstall, type InstallFs, type InstallProblem } from './install.ts'
import { parseLocation, type LocationProblem } from './location.ts'
import { validateStoredSkill, type InstalledFiles, type SkillOrigin, type SkillOriginKind, type StoredSkill } from './skills.ts'

/** Everything that can go wrong before a skill is written. */
export type ImportProblem =
  | LocationProblem
  | GitHubProblem
  | ArchiveProblem
  | InstallProblem
  /** The source was read, but held no directory that looks like a skill. */
  | 'no-skills'
  /** The caller asked for a name the source does not offer. */
  | 'unknown-skill'

/** A failed import, carrying a code the card can turn into advice. */
export class ImportError extends Error {
  /** Stable problem code callers branch on. */
  readonly problem: ImportProblem

  /**
   * @param problem - the classified failure.
   * @param message - a human-readable detail for the log and the card.
   */
  constructor(problem: ImportProblem, message: string) {
    super(message)
    this.name = 'ImportError'
    this.problem = problem
  }
}

/** Where a skill is being read from. */
export type SkillSource =
  | {
    /** A GitHub repository, or any URL {@link parseLocation} understands. */
    readonly kind: 'github'
    /** The text the user typed or pasted. */
    readonly input: string
    /**
     * A directory to narrow to, appended to whatever the URL already scoped.
     * A separate field because a user pasting a repository root and one
     * clicking a tree link should reach the same code with the same result.
     */
    readonly subdirectory?: string
    /** Transport and optional credentials for the GitHub reads. */
    readonly client: GitHubClient
  }
  | {
    /** A zip the caller already has in memory. */
    readonly kind: 'archive'
    /** The archive's file name, recorded as provenance. */
    readonly name: string
    /** The archive's bytes. */
    readonly bytes: Uint8Array
  }

/** One skill a source offers, as the preview reports it. */
export interface SourceCandidate {
  /** The name the registry will use: frontmatter first, directory slug as a fallback. */
  readonly name: string
  /** One-line routing description from the frontmatter; empty when unreadable. */
  readonly description: string
  /** Optional extra routing guidance from the frontmatter. */
  readonly whenToUse?: string
  /** Repository-relative directory holding the `SKILL.md`; empty for a root skill. */
  readonly directory: string
  /** Which layout bucket the directory fell into. */
  readonly layout: SkillLayout
  /** Files this skill would write. */
  readonly files: number
  /** Total bytes this skill would write. */
  readonly bytes: number
  /** Files a discovery limit skipped, so a partial copy is visible before install. */
  readonly dropped: number
  /** Whether the copy looks like a vendored snapshot of another skill. */
  readonly vendored: boolean
  /** Whether the model's session catalog would include it. */
  readonly modelInvocable: boolean
  /** Whether the user-facing slash catalog would include it. */
  readonly userInvocable: boolean
  /** Why this skill cannot be installed; empty when it can. */
  readonly problems: readonly string[]
}

/** Everything one source offers, before anything is written. */
export interface SourceListing {
  /** Which installer produced this listing. */
  readonly kind: SkillOriginKind
  /** The URL the user supplied, or the archive's file name. */
  readonly source: string
  /** `owner/repo` for a GitHub import; absent for an archive. */
  readonly repository?: string
  /** The ref that was resolved, a branch name or a commit sha. */
  readonly ref?: string
  /** The directory the user scoped to; empty when the whole source was read. */
  readonly directory: string
  /** Whether the source was truncated, which makes the listing partial. */
  readonly truncated: boolean
  /** The skills to offer, in directory order. */
  readonly skills: readonly SourceCandidate[]
  /** Directories that looked like skills but lost a name collision. */
  readonly skipped: readonly { readonly directory: string; readonly reason: string }[]
}

/** The outcome of installing the names a caller chose. */
export interface InstallOutcome {
  /** The registry entries to persist, in the order they were requested. */
  readonly installed: readonly StoredSkill[]
  /** Names that produced nothing, with the reason. */
  readonly skipped: readonly { readonly name: string; readonly reason: string }[]
}

/** A discovered skill with its parsed document, before the public projection. */
interface Prepared {
  readonly name: string
  readonly directory: string
  readonly discovered: DiscoveredSkill
  readonly document?: SkillDocument
  readonly problems: readonly string[]
}

/** A source opened for reading: the blobs, and how to fetch one. */
interface OpenedSource {
  readonly kind: SkillOriginKind
  readonly source: string
  readonly repository?: string
  readonly ref?: string
  readonly subpath: string
  readonly truncated: boolean
  readonly blobs: readonly RepoBlob[]
  readonly text: (path: string) => Promise<string>
  readonly bytes: (path: string) => Promise<Uint8Array>
  /** Extra files the reader skipped before discovery, for the preview's honesty. */
  readonly dropped: number
}

/**
 * List the skills a source offers without writing anything.
 * @param source - the repository URL or archive to read.
 * @param limits - discovery ceilings; defaults to {@link DEFAULT_LIMITS}.
 * @returns the listing, ready for the card or the model to show.
 * @throws ImportError when the source cannot be read at all.
 */
export async function listSkills(source: SkillSource, limits: DiscoveryLimits = DEFAULT_LIMITS): Promise<SourceListing> {
  const opened = await openSource(source, limits)
  const prepared = await prepare(opened, limits)
  return project(opened, prepared)
}

/**
 * Install the named skills from a source onto disk.
 *
 * The source is read again rather than trusting a previous listing, so a
 * repository that changed between the preview and the confirmation installs
 * what is actually there. Every chosen skill is written before any entry is
 * returned; a caller that fails halfway still sees the entries for the skills
 * that did land, because the files and the settings document are updated
 * separately.
 * @param options - the source, the managed root, the chosen names, and the filesystem.
 * @returns the registry entries to persist, plus the names that produced nothing.
 * @throws ImportError when the source itself cannot be read.
 */
export async function installSkills(options: {
  readonly source: SkillSource
  readonly root: string
  readonly names: readonly string[]
  readonly fs: InstallFs
  readonly limits?: DiscoveryLimits
  readonly now?: () => Date
}): Promise<InstallOutcome> {
  const limits = options.limits ?? DEFAULT_LIMITS
  const opened = await openSource(options.source, limits)
  const prepared = await prepare(opened, limits)
  const byName = new Map<string, Prepared>()
  for (const item of prepared.prepared) {
    if (item.problems.length === 0) byName.set(item.name, item)
  }
  const at = (options.now ?? (() => new Date()))().toISOString()
  const installed: StoredSkill[] = []
  const skipped: { name: string; reason: string }[] = []
  for (const name of options.names) {
    const item = byName.get(name)
    if (item === undefined) {
      const known = prepared.prepared.find(candidate => candidate.name === name)
      skipped.push({ name, reason: known === undefined ? 'the source no longer offers this skill' : known.problems.join('; ') })
      continue
    }
    installed.push(await writeOne(item, opened, options.root, options.fs, at))
  }
  if (installed.length === 0 && skipped.length === 0) {
    throw new ImportError('no-skills', `${opened.source} offers no skill to install`)
  }
  return { installed, skipped }
}

/** Write one prepared skill and project it onto a registry entry. */
async function writeOne(
  item: Prepared,
  opened: OpenedSource,
  root: string,
  fs: InstallFs,
  installedAt: string,
): Promise<StoredSkill> {
  const plan = planInstall(item.discovered)
  if (!plan.ok) throw new ImportError(plan.problem, `refusing to install "${item.name}": ${plan.problem}`)
  const written = await installSkillFiles({
    root,
    name: item.name,
    files: plan.files,
    read: (source) => opened.bytes(source),
    fs,
  })
  const installed: InstalledFiles = { ...written, dropped: item.discovered.dropped }
  const origin: SkillOrigin = {
    kind: opened.kind,
    source: opened.source,
    ...opened.repository === undefined ? {} : { repository: opened.repository },
    ...opened.ref === undefined ? {} : { ref: opened.ref },
    directory: item.directory,
    installedAt,
  }
  const document = item.document!
  const whenToUse = document.whenToUse?.trim()
  const skill: StoredSkill = {
    name: item.name,
    description: document.description,
    ...whenToUse === undefined || whenToUse.length === 0 ? {} : { whenToUse },
    content: document.content,
    ...document.invocation.modelInvocable ? {} : { disableModelInvocation: true },
    ...document.invocation.userInvocable ? {} : { userInvocable: false },
    origin,
    installed,
  }
  const problems = validateStoredSkill(skill)
  if (problems.length > 0) throw new ImportError('no-skills', `refusing to install "${item.name}": ${problems.join('; ')}`)
  return skill
}

/** The prepared skills, plus the directories that lost a name collision. */
interface PreparedSource {
  readonly prepared: readonly Prepared[]
  readonly skipped: readonly { readonly directory: string; readonly reason: string }[]
}

/** Read every candidate's `SKILL.md` and resolve its real name. */
async function prepare(opened: OpenedSource, limits: DiscoveryLimits): Promise<PreparedSource> {
  const discovered = discoverSkills(opened.blobs, {
    ...opened.subpath.length === 0 ? {} : { subpath: opened.subpath },
    limits,
  })
  const prepared: Prepared[] = []
  for (const skill of discovered) {
    const raw = await opened.text(skill.skillFile)
    const parsed = parseSkillDocument(raw)
    if (parsed.ok) {
      prepared.push({ name: parsed.document.name, directory: skill.directory, discovered: skill, document: parsed.document, problems: [] })
      continue
    }
    // A directory with an unreadable `SKILL.md` still appears in the listing: a
    // human needs to see that the repository was understood and this one entry
    // was not, rather than wonder why a skill silently vanished.
    prepared.push({
      name: skill.slug,
      directory: skill.directory,
      discovered: skill,
      problems: [`${skill.skillFile}: ${parsed.problem}`],
    })
  }
  const { kept, dropped } = dedupeByName(prepared)
  return {
    prepared: kept,
    // A dropped copy is not an error: repositories routinely vendor the same
    // skill twice, and the preview says which directory lost so a user who
    // wanted the other copy can scope the URL at it.
    skipped: dropped.map(item => ({ directory: item.directory, reason: `duplicate name "${item.name}"` })),
  }
}

/** Project the prepared skills onto the serialisable listing shape. */
function project(opened: OpenedSource, source: PreparedSource): SourceListing {
  const skills: SourceCandidate[] = source.prepared.map(item => {
    const document = item.document
    const whenToUse = document?.whenToUse?.trim()
    return {
      name: item.name,
      description: document?.description ?? '',
      ...whenToUse === undefined || whenToUse.length === 0 ? {} : { whenToUse },
      directory: item.directory,
      layout: item.discovered.layout,
      files: item.discovered.files.length,
      bytes: item.discovered.bytes,
      dropped: item.discovered.dropped,
      vendored: item.discovered.vendored,
      modelInvocable: document?.invocation.modelInvocable ?? true,
      userInvocable: document?.invocation.userInvocable ?? true,
      problems: item.problems,
    }
  })
  return {
    kind: opened.kind,
    source: opened.source,
    ...opened.repository === undefined ? {} : { repository: opened.repository },
    ...opened.ref === undefined ? {} : { ref: opened.ref },
    directory: opened.subpath,
    truncated: opened.truncated,
    skills,
    skipped: source.skipped,
  }
}

/** Resolve a source into blobs plus a way to read them. */
async function openSource(source: SkillSource, limits: DiscoveryLimits): Promise<OpenedSource> {
  if (source.kind === 'archive') return openArchive(source, limits)
  const parsed = parseLocation(source.input)
  if (!parsed.ok) throw new ImportError(parsed.problem, `cannot read "${source.input}": ${parsed.problem}`)
  const location = parsed.location
  let tree
  try {
    tree = await resolveTree(location, source.client)
  } catch (error) {
    if (error instanceof GitHubError) throw new ImportError(error.problem, error.message)
    throw error
  }
  const where = `${location.owner}/${location.repo}`
  return {
    kind: 'github',
    source: location.url,
    repository: where,
    ref: tree.ref,
    subpath: scoped(location.subpath, source.subdirectory),
    truncated: tree.truncated,
    blobs: tree.blobs,
    text: (path) => readTextFile(location, tree.ref, path, source.client),
    bytes: (path) => readBinaryFile(location, tree.ref, path, source.client),
    dropped: 0,
  }
}

/** Join the URL's own scope with an explicit subdirectory, in that order. */
function scoped(subpath: string | undefined, subdirectory: string | undefined): string {
  const parts: string[] = []
  if (subpath !== undefined && subpath.length > 0) parts.push(subpath)
  if (subdirectory !== undefined && subdirectory.length > 0) parts.push(subdirectory.replace(/^\/+|\/+$/g, ''))
  return parts.filter(part => part.length > 0).join('/')
}

/** Open an in-memory archive as a source. */
function openArchive(source: { readonly name: string; readonly bytes: Uint8Array }, limits: DiscoveryLimits): OpenedSource {
  const archive = readArchive(source.bytes, archiveLimits(limits))
  if (!archive.ok) throw new ImportError(archive.problem, `cannot read "${source.name}": ${archive.problem}`)
  const byPath = new Map(archive.entries.map(entry => [entry.path, entry.data]))
  return {
    kind: 'archive',
    source: source.name,
    // The wrapping folder was already stripped from every path, so there is no
    // scope left to filter on: recording it here would filter every entry out.
    subpath: '',
    truncated: false,
    blobs: archiveBlobs(archive.entries),
    text: (path) => Promise.resolve(decode(byPath, path)),
    bytes: (path) => Promise.resolve(need(byPath, path)),
    dropped: archive.dropped,
  }
}

/** Scale the archive ceilings from the discovery ceilings the caller set. */
function archiveLimits(limits: DiscoveryLimits): ArchiveLimits {
  return {
    maxEntries: limits.maxFiles * 20,
    maxTotalBytes: limits.maxSkillBytes * 20,
  }
}

/** Decode one archive entry as UTF-8, refusing a path the archive does not hold. */
function decode(byPath: ReadonlyMap<string, Uint8Array>, path: string): string {
  return new TextDecoder().decode(need(byPath, path))
}

/** Look up one archive entry, refusing a path the archive does not hold. */
function need(byPath: ReadonlyMap<string, Uint8Array>, path: string): Uint8Array {
  const data = byPath.get(path)
  if (data === undefined) throw new ImportError('unreadable', `"${path}" is not in the archive`)
  return data
}
