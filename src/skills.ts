/**
 * Declarative skill registry: the persisted value shape, its Schemastery
 * schema, cross-field validation, and the projection into a `ctx.skills`
 * provider candidate.
 *
 * One module owns the value shape because every consumer — the settings
 * section, the model tools, the browser card, and the provider — must agree on
 * it. A managed skill is an ordinary agent skill: it carries the same
 * frontmatter fields a `SKILL.md` file would, so the shipped `skill` tool
 * loads it exactly like one discovered from disk.
 *
 * @module @ctl456/dsh-skills-manager/skills
 */

import z from '@deepseek-ai/schemastery'
import { isSkillName } from '@deepseek-ai/dsh-skill'
import type {
  SkillCandidate,
  SkillDefinition,
  SkillInvocationPolicy,
  SkillSource,
} from '@deepseek-ai/dsh-skill'

/** Settings namespace owning the managed skill registry. */
export const SETTINGS_NS = 'skills-manager'

/** Provider name registered on `ctx.skills`; also the value the UI keys on. */
export const DEFAULT_PROVIDER_NAME = 'skills-manager'

/**
 * Discovery rank of the managed provider. The shipped filesystem provider
 * ranks project roots at 100/200, `customSkillDirs` at 300, the user DSH root
 * at 400, the user agents root at 500, and bundled skills at 600 — so 350
 * keeps a repository's own skills authoritative while managed skills still
 * beat every user-level root.
 */
export const MANAGED_SKILL_RANK = 350

/** Origin bucket recorded on every managed candidate, so the UI can identify its own rows. */
export const MANAGED_SKILL_SOURCE: SkillSource = 'skills-manager'

/** Longest accepted skill name; the registry grammar itself has no length bound. */
export const MAX_SKILL_NAME_LENGTH = 64

/** Longest accepted routing description, matching what a session catalog can usefully render. */
export const MAX_DESCRIPTION_LENGTH = 1_024

/** Longest accepted extra routing guidance. */
export const MAX_WHEN_TO_USE_LENGTH = 1_024

/** Largest accepted instruction body, in UTF-16 code units. */
export const MAX_CONTENT_LENGTH = 262_144

/**
 * One persisted skill. Field names mirror the `SKILL.md` frontmatter keys the
 * filesystem provider parses: `disable-model-invocation` and `user-invocable`
 * become optional booleans whose defaults keep the skill available to both the
 * model and the user's slash catalog.
 */
export interface StoredSkill {
  /** Kebab-case identifier; the model addresses the skill by this name. */
  name: string
  /** Short routing description shown in the session catalog. */
  description: string
  /** Optional extra routing guidance. */
  whenToUse?: string
  /** Markdown instruction body the model reads when it loads the skill. */
  content: string
  /** When true, the skill is stored but hidden from the model catalog. */
  disableModelInvocation?: boolean
  /** When false, the skill is hidden from the user-facing slash catalog. */
  userInvocable?: boolean
  /** Whether the provider publishes this skill at all; defaults to true. */
  enabled?: boolean
}

/** Per-skill schema; every field is optional in the document except the name and body. */
const StoredSkillSchema = z.object({
  name: z.string().required().max(MAX_SKILL_NAME_LENGTH),
  description: z.string().required().max(MAX_DESCRIPTION_LENGTH),
  whenToUse: z.string().max(MAX_WHEN_TO_USE_LENGTH),
  content: z.string().required().max(MAX_CONTENT_LENGTH),
  disableModelInvocation: z.boolean(),
  userInvocable: z.boolean(),
  enabled: z.boolean(),
})

/** The settings-section value: the managed skill registry. */
export interface SkillsSection {
  /** Managed skills, in registration order. */
  skills: StoredSkill[]
}

/** Schemastery schema for the settings section and its composition base layer. */
export const SectionConfig: z<SkillsSection> = z.object({
  skills: z.array(StoredSkillSchema).default([]),
})

/** Plugin configuration: the section schema plus the row's provider identity. */
export interface Config extends SkillsSection {
  /** Provider name registered on `ctx.skills`; defaults to `skills-manager`. */
  providerName?: string
  /** Discovery rank; defaults to {@link MANAGED_SKILL_RANK}. */
  rank?: number
  /** Whether to register the model-facing `skills_manager_*` tools; defaults to true. */
  tools?: boolean
}

/** Schemastery schema for the composition entry. */
export const Config: z<Config> = z.object({
  skills: z.array(StoredSkillSchema).default([]),
  providerName: z.string().min(1).default(DEFAULT_PROVIDER_NAME),
  rank: z.number().default(MANAGED_SKILL_RANK),
  tools: z.boolean().default(true),
})

/**
 * Resolve a skill's invocation policy. Absent flags permit both audiences,
 * matching the filesystem provider's frontmatter defaults.
 * @param skill - the stored skill to project.
 * @returns the resolved model and user invocation controls.
 */
export function invocationOf(skill: StoredSkill): SkillInvocationPolicy {
  return {
    modelInvocable: skill.disableModelInvocation !== true,
    userInvocable: skill.userInvocable !== false,
  }
}

/**
 * Report every reason a stored skill cannot be published. The registry rejects
 * a malformed candidate by throwing, which would fail the whole catalog, so the
 * provider filters on this list instead of handing it a bad entry.
 * @param skill - the stored skill to check.
 * @returns human-readable problems, empty when the entry is publishable.
 */
export function validateStoredSkill(skill: StoredSkill): string[] {
  const problems: string[] = []
  if (!isSkillName(skill.name)) {
    problems.push(`"${skill.name}" is not a kebab-case skill name (lowercase letters, digits, and single hyphens)`)
  } else if (skill.name.length > MAX_SKILL_NAME_LENGTH) {
    problems.push(`the name is longer than ${String(MAX_SKILL_NAME_LENGTH)} characters`)
  }
  const description = skill.description.trim()
  if (description.length === 0) problems.push('the description is empty')
  else if (description.length > MAX_DESCRIPTION_LENGTH) {
    problems.push(`the description is longer than ${String(MAX_DESCRIPTION_LENGTH)} characters`)
  }
  if ((skill.whenToUse?.length ?? 0) > MAX_WHEN_TO_USE_LENGTH) {
    problems.push(`the "when to use" note is longer than ${String(MAX_WHEN_TO_USE_LENGTH)} characters`)
  }
  if (skill.content.trim().length === 0) problems.push('the instructions are empty')
  else if (skill.content.length > MAX_CONTENT_LENGTH) {
    problems.push(`the instructions are longer than ${String(MAX_CONTENT_LENGTH)} characters`)
  }
  return problems
}

/**
 * Project one stored skill onto the registry's candidate shape.
 * @param skill - a valid stored skill.
 * @param options - the provider name and discovery rank to stamp on the candidate.
 * @returns the candidate the registry merges; the locator is the skill name.
 */
export function toCandidate(
  skill: StoredSkill,
  options: { readonly providerName: string; readonly rank: number },
): SkillCandidate {
  const whenToUse = skill.whenToUse?.trim()
  return {
    name: skill.name,
    description: skill.description.trim(),
    ...whenToUse === undefined || whenToUse.length === 0 ? {} : { whenToUse },
    invocation: invocationOf(skill),
    source: MANAGED_SKILL_SOURCE,
    provider: options.providerName,
    rank: options.rank,
    locator: skill.name,
  }
}

/**
 * Project one stored skill onto a complete definition, body included.
 * @param skill - a valid stored skill.
 * @param options - the provider name and discovery rank to stamp on the definition.
 * @returns the definition `ctx.skills.get()` resolves for this name.
 */
export function toDefinition(
  skill: StoredSkill,
  options: { readonly providerName: string; readonly rank: number },
): SkillDefinition {
  return { ...toCandidate(skill, options), content: skill.content.trim() }
}
