/**
 * Read a `SKILL.md` document the way the shipped filesystem provider reads one.
 *
 * An imported skill must be indistinguishable from a discovered one, so the
 * frontmatter rules here mirror `skill-filesystem` exactly: a leading `---`
 * block parsed as YAML, `name` and `description` required, `whenToUse` as the
 * optional extra routing hint, and the kebab-case invocation flags
 * `disable-model-invocation` / `user-invocable` with the same permissive
 * boolean forms. The legacy camelCase spellings are rejected rather than
 * silently ignored, so a repository using them reports a readable problem
 * instead of importing a skill that behaves differently than its author meant.
 *
 * @module @ctl456/dsh-skills-manager/frontmatter
 */

import { parse as parseYaml } from 'yaml'
import { isSkillName } from '@deepseek-ai/dsh-skill'
import type { SkillInvocationPolicy } from '@deepseek-ai/dsh-skill'

/** Why a `SKILL.md` could not be read as a skill. */
export type SkillDocumentProblem =
  /** The file has no leading `---` frontmatter block. */
  | 'missing-frontmatter'
  /** The frontmatter block is not a YAML mapping. */
  | 'invalid-frontmatter'
  /** `name` is absent, or is not a kebab-case skill name. */
  | 'invalid-name'
  /** `description` is absent or empty. */
  | 'missing-description'
  /** An invocation flag is present but not a boolean. */
  | 'invalid-invocation'

/** The routing metadata a `SKILL.md` contributes to the registry. */
export interface SkillDocument {
  /** Kebab-case skill name from the frontmatter. */
  readonly name: string
  /** One-line routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** Resolved model and user invocation controls. */
  readonly invocation: SkillInvocationPolicy
  /** Markdown body with the frontmatter block removed. */
  readonly content: string
  /** The parsed frontmatter mapping, for callers that want to echo it. */
  readonly data: Readonly<Record<string, unknown>>
}

/** The outcome of reading one `SKILL.md`. */
export type SkillDocumentResult =
  | { readonly ok: true; readonly document: SkillDocument }
  | { readonly ok: false; readonly problem: SkillDocumentProblem }

/**
 * Parse one `SKILL.md` body into the registry's shape.
 * @param raw - the file's full text, frontmatter included.
 * @returns the skill, or the first reason it could not be read.
 */
export function parseSkillDocument(raw: string): SkillDocumentResult {
  const parsed = splitFrontmatter(raw)
  if (parsed === undefined) return { ok: false, problem: 'missing-frontmatter' }
  const { data, body } = parsed
  const name = stringField(data, 'name')
  if (name === undefined || !isSkillName(name)) return { ok: false, problem: 'invalid-name' }
  const description = stringField(data, 'description')
  if (description === undefined) return { ok: false, problem: 'missing-description' }
  let invocation: SkillInvocationPolicy
  try {
    invocation = parseInvocationPolicy(data)
  } catch {
    return { ok: false, problem: 'invalid-invocation' }
  }
  const whenToUse = stringField(data, 'whenToUse')
  return {
    ok: true,
    document: {
      name,
      description: description.trim(),
      ...whenToUse === undefined ? {} : { whenToUse },
      invocation,
      content: body.trim(),
      data,
    },
  }
}

/**
 * Split a Markdown document into its YAML frontmatter and the body below it.
 * @param raw - the file's full text.
 * @returns the mapping and body, or undefined when the document has no frontmatter block.
 */
export function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } | undefined {
  const firstLineEnd = raw.indexOf('\n')
  if (firstLineEnd < 0) return undefined
  if (raw.slice(0, firstLineEnd).replace(/\r$/, '') !== '---') return undefined
  const closing = findClosing(raw, firstLineEnd + 1)
  if (closing === undefined) return undefined
  let parsed: unknown
  try {
    parsed = parseYaml(raw.slice(firstLineEnd + 1, closing.start)) as unknown
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  return { data: parsed as Record<string, unknown>, body: raw.slice(closing.bodyStart) }
}

/** Find the closing `---` line and where the body starts after it. */
function findClosing(raw: string, start: number): { start: number; bodyStart: number } | undefined {
  let lineStart = start
  while (lineStart <= raw.length) {
    const nextNewline = raw.indexOf('\n', lineStart)
    const lineEnd = nextNewline < 0 ? raw.length : nextNewline
    if (raw.slice(lineStart, lineEnd).replace(/\r$/, '') === '---') {
      return { start: lineStart, bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1 }
    }
    if (nextNewline < 0) return undefined
    lineStart = nextNewline + 1
  }
  return undefined
}

/** Read a non-empty string field. */
function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Resolve the invocation flags, rejecting the legacy camelCase spellings. */
function parseInvocationPolicy(data: Record<string, unknown>): SkillInvocationPolicy {
  rejectLegacyKey(data, 'disableModelInvocation', 'disable-model-invocation')
  rejectLegacyKey(data, 'modelInvocable', 'disable-model-invocation')
  rejectLegacyKey(data, 'userInvocable', 'user-invocable')
  return {
    modelInvocable: frontmatterBoolean(data, 'disable-model-invocation') !== true,
    userInvocable: frontmatterBoolean(data, 'user-invocable') !== false,
  }
}

/** Fail on a legacy invocation key so the author sees the canonical spelling. */
function rejectLegacyKey(data: Record<string, unknown>, legacy: string, canonical: string): void {
  if (Object.hasOwn(data, legacy)) {
    throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`)
  }
}

/** Read a permissive boolean flag, matching the filesystem provider's forms. */
function frontmatterBoolean(data: Record<string, unknown>, key: string): boolean | undefined {
  if (!Object.hasOwn(data, key)) return undefined
  const value = data[key]
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  if (typeof value === 'string') {
    switch (value.toLowerCase()) {
      case 'true': case 'yes': case 'on': return true
      case 'false': case 'no': case 'off': return false
    }
  }
  throw new TypeError(`frontmatter field "${key}" must be a boolean`)
}
