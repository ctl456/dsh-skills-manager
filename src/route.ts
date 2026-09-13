/**
 * The card's import endpoint: one authenticated `POST` route that previews a
 * source and installs from it.
 *
 * The card cannot do this work itself. Reading a repository and writing a
 * skill's files need the host's network and filesystem, and the settings scope
 * the card already holds can only edit the registry document. Connection
 * routes exist for exactly this case — the same channel the session log export
 * uses — so the card sends a small JSON request and the host answers with the
 * preview or the install result.
 *
 * The route is a pure function of an importer and a `Request`, so every branch
 * is testable without a web server, and the transport's own trust and
 * authentication fence applies before this code runs.
 *
 * @module @ctl456/dsh-skills-manager/route
 */

import { Buffer } from 'node:buffer'
import { ImportError, type SourceListing } from './source.ts'
import type { ImportOutcome, ImportPort, ImportTarget, SkillStatus } from './tools.ts'

/** Absolute path of the card's import route, below the shared `/api` channel. */
export const SKILLS_IMPORT_PATH = '/api/skills-manager.import'

/** Largest archive the card may send, in bytes, before base64 expansion. */
export const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024

/** What a preview request answers with. */
export interface ImportPreviewResponse {
  /** Discriminator for the response union. */
  readonly ok: true
  /** Which gesture this answered. */
  readonly action: 'preview'
  /** Every skill the source offers. */
  readonly listing: SourceListing
}

/** What an install request answers with. */
export interface ImportInstallResponse {
  /** Discriminator for the response union. */
  readonly ok: true
  /** Which gesture this answered. */
  readonly action: 'install'
  /** The entries that were written and are now in the registry. */
  readonly installed: readonly SkillStatus[]
  /** Names that produced nothing, with the reason. */
  readonly skipped: readonly { readonly name: string; readonly reason: string }[]
}

/** What a refused import answers with. */
export interface ImportFailureResponse {
  /** Discriminator for the response union. */
  readonly ok: false
  /** Stable problem code, so the card can pick the right advice. */
  readonly problem: string
  /** Human-readable detail; already free of host paths and credentials. */
  readonly message: string
}

/** Everything the route can answer. */
export type ImportResponse = ImportPreviewResponse | ImportInstallResponse | ImportFailureResponse

/** The JSON body one request carries. */
interface ImportRequestBody {
  /** Which gesture the card is asking for. */
  readonly action?: unknown
  /** A repository URL or `owner/repo` shorthand. */
  readonly source?: unknown
  /** A directory inside the repository to read instead of the whole thing. */
  readonly subdirectory?: unknown
  /** An uploaded archive, as `{ name, base64 }`. */
  readonly archive?: unknown
  /** The names to install; omitted or empty previews instead. */
  readonly skills?: unknown
}

/**
 * Handle one import request.
 * @param importer - the host importer the route drives.
 * @param request - the decoded request; its body must be JSON.
 * @returns a JSON response, always with a `ok` discriminator.
 */
export async function importRoute(importer: ImportPort, request: Request): Promise<Response> {
  if (request.method !== 'POST') return failure(405, 'method', 'this route accepts POST only')
  let body: ImportRequestBody
  try {
    body = await request.json() as ImportRequestBody
  } catch {
    return failure(400, 'malformed', 'the request body is not JSON')
  }
  if (typeof body !== 'object' || body === null) return failure(400, 'malformed', 'the request body is not an object')
  const action = body.action
  if (action !== 'preview' && action !== 'install') {
    return failure(400, 'malformed', 'action must be "preview" or "install"')
  }
  const parsed = targetOf(body)
  if (!parsed.ok) return failure(400, parsed.problem, parsed.message)
  const names = namesOf(body.skills)
  if (!names.ok) return failure(400, 'malformed', names.message)
  if (action === 'install' && names.names.length === 0) {
    return failure(400, 'malformed', 'installing needs at least one skill name; omit "skills" to preview')
  }
  try {
    if (action === 'preview') {
      const listing = await importer.preview(parsed.target)
      return json(200, { ok: true, action: 'preview', listing } satisfies ImportPreviewResponse)
    }
    const outcome: ImportOutcome = await importer.install(parsed.target, names.names)
    return json(200, {
      ok: true,
      action: 'install',
      installed: outcome.installed,
      skipped: outcome.skipped,
    } satisfies ImportInstallResponse)
  } catch (error: unknown) {
    if (error instanceof ImportError) return failure(statusFor(error.problem), error.problem, error.message)
    // An unexpected failure is answered without echoing its message: an
    // arbitrary error may carry an absolute host path or a fetch URL.
    return failure(500, 'internal', 'the import failed unexpectedly; see the host log')
  }
}

/** Map an importer problem onto an HTTP status the card can act on. */
function statusFor(problem: string): number {
  if (problem === 'rate-limited' || problem === 'unauthorized' || problem === 'network') return 502
  if (problem === 'truncated') return 502
  return 400
}

/** Read the target a request describes, or the reason it does not describe one. */
function targetOf(body: ImportRequestBody):
  | { readonly ok: true; readonly target: ImportTarget }
  | { readonly ok: false; readonly problem: string; readonly message: string } {
  if (body.archive !== undefined && body.source !== undefined) {
    return { ok: false, problem: 'malformed', message: 'send either "source" or "archive", not both' }
  }
  if (body.archive !== undefined) {
    const archive = body.archive
    if (typeof archive !== 'object' || archive === null) {
      return { ok: false, problem: 'malformed', message: '"archive" must be an object' }
    }
    const { name, base64 } = archive as { name?: unknown; base64?: unknown }
    if (typeof name !== 'string' || name.length === 0 || name.length > 256) {
      return { ok: false, problem: 'malformed', message: '"archive.name" must be a non-empty file name' }
    }
    if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      return { ok: false, problem: 'malformed', message: '"archive.base64" must be base64 text' }
    }
    // Test the encoded length first so an oversized upload is never decoded.
    if (base64.length > Math.ceil(MAX_ARCHIVE_BYTES / 3) * 4) {
      return {
        ok: false,
        problem: 'too-large',
        message: `the archive is larger than the ${String(MAX_ARCHIVE_BYTES)} byte upload limit`,
      }
    }
    const bytes = Buffer.from(base64, 'base64')
    if (bytes.byteLength === 0) return { ok: false, problem: 'malformed', message: 'the archive is empty' }
    return { ok: true, target: { kind: 'archive', name, bytes } }
  }
  if (typeof body.source !== 'string' || body.source.trim().length === 0) {
    return { ok: false, problem: 'malformed', message: '"source" must be a non-empty repository URL' }
  }
  if (body.subdirectory !== undefined && typeof body.subdirectory !== 'string') {
    return { ok: false, problem: 'malformed', message: '"subdirectory" must be a string' }
  }
  const subdirectory = typeof body.subdirectory === 'string' ? body.subdirectory.trim() : ''
  return {
    ok: true,
    target: {
      kind: 'github',
      source: body.source.trim(),
      ...subdirectory.length === 0 ? {} : { subdirectory },
    },
  }
}

/** Read the requested names, refusing a list that is not a list of strings. */
function namesOf(value: unknown): { readonly ok: true; readonly names: readonly string[] } | { readonly ok: false; readonly message: string } {
  if (value === undefined) return { ok: true, names: [] }
  if (!Array.isArray(value)) return { ok: false, message: '"skills" must be an array of names' }
  const names: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      return { ok: false, message: '"skills" must contain only non-empty names' }
    }
    names.push(entry.trim())
  }
  return { ok: true, names }
}

/** One JSON response. */
function json(status: number, body: ImportResponse): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/** One refusal, in the same shape as a success so the card parses once. */
function failure(status: number, problem: string, message: string): Response {
  return json(status, { ok: false, problem, message } satisfies ImportFailureResponse)
}
