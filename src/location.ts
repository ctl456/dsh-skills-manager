/**
 * Parse what a user typed into a location the installer can read.
 *
 * People paste every shape GitHub offers — the repository page, a `/tree/`
 * branch, a `/tree/<branch>/<dir>` subdirectory, a `/blob/` file, a
 * `raw.githubusercontent.com` link, an `owner/repo` shorthand, or an scp-style
 * clone URL — and the referenced repositories disagree about where a skill
 * lives. This module answers only "which repository, which ref, which path";
 * finding the skills is {@link ./discovery.ts}.
 *
 * @module @ctl456/dsh-skills-manager/location
 */

/** Hosts whose web URLs this module understands. */
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])
const RAW_HOSTS = new Set(['raw.githubusercontent.com', 'raw.github.com'])

/** Why a typed location could not be turned into a repository pointer. */
export type LocationProblem =
  /** The input was empty or only whitespace. */
  | 'empty'
  /** The input is a URL, but not one this installer can read. */
  | 'unsupported-host'
  /** The input looks like a path but does not name `<owner>/<repo>`. */
  | 'malformed'
  /** The input points at a single file that is not a `SKILL.md`. */
  | 'not-a-skill-file'

/** A GitHub repository the installer can read through the REST API. */
export interface GitHubLocation {
  /** Discriminator for the location union. */
  readonly kind: 'github'
  /** Repository owner, the first path segment. */
  readonly owner: string
  /** Repository name, without a trailing `.git`. */
  readonly repo: string
  /** Explicit ref from a `/tree/` or `/blob/` URL; absent means the default branch. */
  readonly ref?: string
  /** Directory the user scoped to; absent means the whole repository. */
  readonly subpath?: string
  /** File the user linked directly; only a `SKILL.md` is meaningful here. */
  readonly file?: string
  /** Canonical browsable URL, kept for provenance and for the card to show. */
  readonly url: string
}

/** The outcome of parsing one typed location. */
export type LocationResult =
  | { readonly ok: true; readonly location: GitHubLocation }
  | { readonly ok: false; readonly problem: LocationProblem }

/** One way to split a repo-relative path into a ref and the path below it. */
export interface RefSplit {
  /** The candidate ref, as it would be passed to the API. */
  readonly ref: string
  /** The repository-relative path below that ref; empty when the ref is the whole path. */
  readonly path: string
}

/**
 * Parse a user-supplied repository location.
 *
 * Accepts `https://github.com/<owner>/<repo>`, a `/tree/<ref>[/<dir>]` or
 * `/blob/<ref>/<file>` URL, a `raw.githubusercontent.com` file URL, an
 * `owner/repo` shorthand, and `git@github.com:<owner>/<repo>.git`.
 * @param input - the raw text the user typed or pasted.
 * @returns the repository pointer, or why the text could not be read.
 */
export function parseLocation(input: string): LocationResult {
  const text = input.trim().replace(/^<|>$/g, '')
  if (text.length === 0) return { ok: false, problem: 'empty' }
  const scp = /^git@([^:]+):(.+)$/.exec(text)
  if (scp !== null) return fromPathParts(scp[2]!, scp[1]!.toLowerCase(), text)
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : undefined
  if (withScheme !== undefined) {
    let parsed: URL
    try {
      parsed = new URL(withScheme)
    } catch {
      return { ok: false, problem: 'malformed' }
    }
    const host = parsed.hostname.toLowerCase()
    if (RAW_HOSTS.has(host)) return fromRawPath(parsed.pathname, withScheme)
    if (!GITHUB_HOSTS.has(host)) return { ok: false, problem: 'unsupported-host' }
    return fromGitHubPath(parsed.pathname, withScheme)
  }
  // No scheme and no host: an `owner/repo` shorthand, optionally with a path.
  return fromPathParts(text, 'github.com', text)
}

/**
 * Split a repository-relative path into the candidate ref/path pairs to try.
 *
 * `/tree/<a>/<b>/<c>` is ambiguous — the branch could be `a`, `a/b`, or the
 * whole thing could be a path on the default branch — and GitHub itself guesses
 * the same way. The resolver walks these longest-ref-first so a real branch
 * whose name contains a slash still wins over a directory of the same name.
 * @param ref - the ref segment the URL named, or undefined for the default branch.
 * @param rest - the path segments below the ref, already split on `/`.
 * @returns the splits to try, in the order the resolver should attempt them.
 */
export function refSplits(ref: string | undefined, rest: readonly string[]): RefSplit[] {
  if (ref === undefined) return [{ ref: '', path: rest.join('/') }]
  const splits: RefSplit[] = []
  for (let take = rest.length; take >= 0; take -= 1) {
    splits.push({ ref: [ref, ...rest.slice(0, take)].join('/'), path: rest.slice(take).join('/') })
  }
  return splits
}

/** Build a location from the path of a github.com URL. */
function fromGitHubPath(pathname: string, url: string): LocationResult {
  const segments = decodeSegments(pathname)
  if (segments.length < 2) return { ok: false, problem: 'malformed' }
  const owner = segments[0]!
  const repo = stripGitSuffix(segments[1]!)
  if (owner.length === 0 || repo.length === 0) return { ok: false, problem: 'malformed' }
  const marker = segments[2]
  if (marker !== 'tree' && marker !== 'blob') {
    return { ok: true, location: { kind: 'github', owner, repo, url: `https://github.com/${owner}/${repo}` } }
  }
  const ref = segments[3]
  if (ref === undefined) {
    return { ok: true, location: { kind: 'github', owner, repo, url: `https://github.com/${owner}/${repo}` } }
  }
  const rest = segments.slice(4)
  if (marker === 'blob') {
    const file = rest.join('/')
    if (!isSkillFileName(file)) return { ok: false, problem: 'not-a-skill-file' }
    return {
      ok: true,
      location: {
        kind: 'github',
        owner,
        repo,
        ref,
        ...rest.length > 1 ? { subpath: rest.slice(0, -1).join('/') } : {},
        file: rest.at(-1)!,
        url,
      },
    }
  }
  return {
    ok: true,
    location: {
      kind: 'github',
      owner,
      repo,
      ref,
      ...rest.length > 0 ? { subpath: rest.join('/') } : {},
      url,
    },
  }
}

/** Build a location from a raw.githubusercontent.com path. */
function fromRawPath(pathname: string, url: string): LocationResult {
  const segments = decodeSegments(pathname)
  if (segments.length < 4) return { ok: false, problem: 'malformed' }
  const [owner, rawRepo, ref, ...rest] = segments as [string, string, string, ...string[]]
  const repo = stripGitSuffix(rawRepo)
  if (!isSkillFileName(rest.join('/'))) return { ok: false, problem: 'not-a-skill-file' }
  return {
    ok: true,
    location: {
      kind: 'github',
      owner,
      repo,
      ref,
      ...rest.length > 1 ? { subpath: rest.slice(0, -1).join('/') } : {},
      file: rest.at(-1)!,
      url,
    },
  }
}

/** Build a location from bare `owner/repo[/...]` path segments. */
function fromPathParts(text: string, _host: string, url: string): LocationResult {
  const segments = decodeSegments(text.replace(/^\/+/, ''))
  if (segments.length < 2) return { ok: false, problem: 'malformed' }
  const owner = segments[0]!
  const repo = stripGitSuffix(segments[1]!)
  if (owner.length === 0 || repo.length === 0) return { ok: false, problem: 'malformed' }
  const rest = segments.slice(2)
  const marker = rest[0]
  if (marker === 'tree' || marker === 'blob') {
    const ref = rest[1]
    const below = rest.slice(2)
    if (marker === 'blob') {
      if (!isSkillFileName(below.join('/'))) return { ok: false, problem: 'not-a-skill-file' }
      return {
        ok: true,
        location: {
          kind: 'github', owner, repo,
          ...ref === undefined ? {} : { ref },
          ...below.length > 1 ? { subpath: below.slice(0, -1).join('/') } : {},
          ...below.length > 0 ? { file: below.at(-1)! } : {},
          url,
        },
      }
    }
    return {
      ok: true,
      location: {
        kind: 'github', owner, repo,
        ...ref === undefined ? {} : { ref },
        ...below.length > 0 ? { subpath: below.join('/') } : {},
        url,
      },
    }
  }
  return {
    ok: true,
    location: {
      kind: 'github', owner, repo,
      ...rest.length > 0 ? { subpath: rest.join('/') } : {},
      url,
    },
  }
}

/** Decode each path segment, leaving a malformed escape literal. */
function decodeSegments(path: string): string[] {
  return path.split('/').filter(segment => segment.length > 0).map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })
}

/** Strip a trailing `.git`, which clone URLs carry and web URLs do not. */
function stripGitSuffix(repo: string): string {
  return repo.endsWith('.git') ? repo.slice(0, -4) : repo
}

/** Whether a path names a skill instruction file. */
export function isSkillFileName(path: string): boolean {
  const base = path.split('/').at(-1) ?? ''
  return base.toLowerCase() === 'skill.md'
}
