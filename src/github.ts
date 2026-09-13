/**
 * Read a skill repository over the GitHub REST API.
 *
 * Two endpoints do all the work, chosen so an import costs as few rate-limited
 * requests as possible: one `git/trees/<ref>?recursive=1` call lists the whole
 * repository, and everything afterwards is fetched from
 * `raw.githubusercontent.com`, which serves file content without counting
 * against the API quota. That split is what makes a 197-skill repository like
 * `manyuegong33/r0crawl_skills` practical to import one skill out of.
 *
 * The `fetch` used here is injected rather than global, so the resolver is
 * testable against recorded responses and a deployment can supply its own
 * transport.
 *
 * @module @ctl456/dsh-skills-manager/github
 */

import type { RepoBlob } from './discovery.ts'
import { refSplits, type GitHubLocation } from './location.ts'

/** Base of the REST API that lists trees and repositories. */
const API_BASE = 'https://api.github.com'

/** Base of the raw content host, which is not rate-limited like the API. */
const RAW_BASE = 'https://raw.githubusercontent.com'

/**
 * Ceiling on one GitHub read. A socket that stalls without closing leaves the
 * request pending forever, and there is nothing above this layer that would end
 * it: an import that hangs holds the card's dialog open with no way back, so the
 * read has to fail on its own. Every request here is a small JSON document or a
 * text file, so a read this slow is already a failure.
 */
const REQUEST_TIMEOUT_MS = 30_000

/** How a GitHub read failed, in terms the card can turn into advice. */
export type GitHubProblem =
  /** The repository, ref, or file does not exist. */
  | 'not-found'
  /** The API refused because the caller exceeded the anonymous quota. */
  | 'rate-limited'
  /** The API refused because the token is missing, expired, or lacks access. */
  | 'unauthorized'
  /** The tree is too large for the API to return in one response. */
  | 'truncated'
  /** The request never completed. */
  | 'network'

/** A failed GitHub read, carrying a problem code rather than a parsed message. */
export class GitHubError extends Error {
  /** Stable problem code callers branch on. */
  readonly problem: GitHubProblem
  /** HTTP status when the failure came from a response. */
  readonly status: number | undefined

  /**
   * @param problem - the classified failure.
   * @param message - a human-readable detail for the log.
   * @param status - the HTTP status, when there was one.
   */
  constructor(problem: GitHubProblem, message: string, status?: number) {
    super(message)
    this.name = 'GitHubError'
    this.problem = problem
    this.status = status
  }
}

/** The transport and credentials one import runs with. */
export interface GitHubClient {
  /** Fetch implementation to use; injected so tests and hosts can substitute one. */
  readonly fetch: typeof fetch
  /** Optional token, sent as a bearer credential for private repositories and a higher quota. */
  readonly token?: string
  /** Abort signal owned by the caller, so closing the card cancels the reads. */
  readonly signal?: AbortSignal
}

/** A resolved repository tree. */
export interface ResolvedTree {
  /** The ref the tree was read at, a branch name or commit sha. */
  readonly ref: string
  /** Every blob in the repository. */
  readonly blobs: readonly RepoBlob[]
  /** Whether GitHub truncated the listing, which makes discovery partial. */
  readonly truncated: boolean
}

/**
 * Resolve a location to a tree.
 *
 * A `/tree/<a>/<b>` URL is ambiguous about where the ref ends, so each
 * candidate split is tried in turn and the first that resolves wins — the same
 * guess GitHub's own web UI makes. A location without an explicit ref reads the
 * repository's default branch.
 * @param location - the parsed repository pointer.
 * @param client - the transport and optional credentials.
 * @returns the ref and every blob at it.
 * @throws GitHubError when the repository, the ref, or the network fails.
 */
export async function resolveTree(location: GitHubLocation, client: GitHubClient): Promise<ResolvedTree> {
  if (location.ref === undefined) {
    const defaultBranch = await readDefaultBranch(location, client)
    return await readTree(location, defaultBranch, client)
  }
  const rest = splitPath(location.subpath)
  const splits = refSplits(location.ref, rest)
  let failure: GitHubError | undefined
  for (const split of splits) {
    try {
      const tree = await readTreeAt(location, split.ref, client)
      return { ...tree, ref: split.ref }
    } catch (error) {
      if (!(error instanceof GitHubError)) throw error
      // Only a missing ref is worth retrying with a different split; a quota or
      // auth failure would repeat identically for every candidate.
      if (error.problem !== 'not-found') throw error
      failure = error
    }
  }
  /* v8 ignore next -- refSplits always yields at least one split, so a loop that
     never returned always assigned `failure` from a not-found error. */
  throw failure ?? new GitHubError('not-found', `no ref matched in ${location.url}`)
}

/**
 * Read a text file at a ref.
 * @param location - the repository pointer, for owner and repo.
 * @param ref - the resolved ref.
 * @param path - repository-relative path.
 * @param client - the transport and optional credentials.
 * @returns the file's text.
 * @throws GitHubError when the file is missing or the read fails.
 */
export async function readTextFile(
  location: GitHubLocation,
  ref: string,
  path: string,
  client: GitHubClient,
): Promise<string> {
  const response = await send(rawUrl(location, ref, path), client, 'text')
  return await response.text()
}

/**
 * Read a binary file at a ref.
 * @param location - the repository pointer, for owner and repo.
 * @param ref - the resolved ref.
 * @param path - repository-relative path.
 * @param client - the transport and optional credentials.
 * @returns the file's bytes.
 * @throws GitHubError when the file is missing or the read fails.
 */
export async function readBinaryFile(
  location: GitHubLocation,
  ref: string,
  path: string,
  client: GitHubClient,
): Promise<Uint8Array> {
  const response = await send(rawUrl(location, ref, path), client, 'binary')
  return new Uint8Array(await response.arrayBuffer())
}

/** Read the repository's default branch name. */
async function readDefaultBranch(location: GitHubLocation, client: GitHubClient): Promise<string> {
  const response = await send(`${API_BASE}/repos/${location.owner}/${location.repo}`, client, 'json')
  const body = await response.json() as { default_branch?: unknown }
  if (typeof body.default_branch !== 'string' || body.default_branch.length === 0) {
    throw new GitHubError('not-found', `${location.owner}/${location.repo} reports no default branch`)
  }
  return body.default_branch
}

/** Read the tree of the default branch. */
async function readTree(location: GitHubLocation, ref: string, client: GitHubClient): Promise<ResolvedTree> {
  const tree = await readTreeAt(location, ref, client)
  return { ...tree, ref }
}

/** Read the tree at one candidate ref, mapping a miss to `not-found`. */
async function readTreeAt(location: GitHubLocation, ref: string, client: GitHubClient): Promise<Omit<ResolvedTree, 'ref'>> {
  const url = `${API_BASE}/repos/${location.owner}/${location.repo}/git/trees/${encodePath(ref)}?recursive=1`
  const response = await send(url, client, 'json')
  const body = await response.json() as { tree?: unknown; truncated?: unknown }
  if (!Array.isArray(body.tree)) {
    throw new GitHubError('not-found', `${location.owner}/${location.repo}@${ref} returned no tree`)
  }
  const blobs: RepoBlob[] = []
  for (const entry of body.tree as { type?: unknown; path?: unknown; size?: unknown }[]) {
    // Submodules arrive as `commit` entries and carry no readable content.
    if (entry.type !== 'blob') continue
    if (typeof entry.path !== 'string') continue
    blobs.push({ path: entry.path, size: typeof entry.size === 'number' ? entry.size : 0 })
  }
  return { blobs, truncated: body.truncated === true }
}

/** Issue one request and classify a non-success response. */
async function send(url: string, client: GitHubClient, accept: 'json' | 'text' | 'binary'): Promise<Response> {
  const headers: Record<string, string> = {
    accept: accept === 'json'
      ? 'application/vnd.github+json'
      : accept === 'text' ? 'text/plain' : 'application/octet-stream',
    'user-agent': 'dsh-skills-manager',
    'x-github-api-version': '2022-11-28',
  }
  if (client.token !== undefined && client.token.length > 0) headers.authorization = `Bearer ${client.token}`
  let response: Response
  // The timeout is fused with the caller's signal rather than replacing it, so
  // closing the card still cancels first when the user is the one giving up.
  const signal = client.signal === undefined
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : AbortSignal.any([client.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
  try {
    response = await client.fetch(url, { headers, signal })
  } catch (error) {
    throw new GitHubError('network', `request to ${url} failed: ${String(error)}`)
  }
  if (response.ok) return response
  throw classify(response, url)
}

/** Map an HTTP failure onto the problem taxonomy. */
function classify(response: Response, url: string): GitHubError {
  const detail = `${response.status} ${response.statusText} for ${url}`
  if (response.status === 404) return new GitHubError('not-found', detail, 404)
  if (response.status === 401) return new GitHubError('unauthorized', detail, 401)
  if (response.status === 403 || response.status === 429) {
    // GitHub answers both an exhausted quota and a forbidden token with 403;
    // the remaining-quota header is what tells them apart.
    const remaining = response.headers.get('x-ratelimit-remaining')
    return remaining === '0'
      ? new GitHubError('rate-limited', detail, response.status)
      : new GitHubError('unauthorized', detail, response.status)
  }
  if (response.status === 422) return new GitHubError('truncated', detail, 422)
  return new GitHubError('network', detail, response.status)
}

/** Build a raw content URL for one repository-relative path. */
function rawUrl(location: GitHubLocation, ref: string, path: string): string {
  return `${RAW_BASE}/${location.owner}/${location.repo}/${encodePath(ref)}/${encodePath(path)}`
}

/** Percent-encode each path segment, leaving the separators intact. */
function encodePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

/** Split a subpath into segments for the ref-splitting search. */
function splitPath(subpath: string | undefined): string[] {
  if (subpath === undefined || subpath.length === 0) return []
  return subpath.split('/')
}
