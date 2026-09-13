/**
 * Skills manager plugin: one place to add, remove, enable, and disable agent
 * skills, and the provider registration that makes the harness able to load
 * them.
 *
 * The plugin keeps a declarative registry of skills. The registry is stored in
 * the `skills-manager` user-settings section when a settings provider is
 * composed (the Web profile mounts one), so the browser card and the model
 * tools edit the same document.
 *
 * Making a skill loadable is deliberately not this plugin's job: the manager
 * registers one ordinary `ctx.skills` provider, so the shipped session catalog
 * advertises managed skills beside the filesystem ones and the shipped `skill`
 * tool loads their bodies. A skill added from chat or from the page is
 * therefore a first-class skill, not a private list entry.
 *
 * Named exports (no default export) so the Loader reads `name`, `inject`, and
 * `Config` for injection and validation.
 *
 * @module @ctl456/dsh-skills-manager
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
// Type-only: resolves the `ctx.skills` Context augmentation.
import type {} from '@deepseek-ai/dsh-skill'
// Type-only: resolves the `ctx.tools` Context augmentation.
import type {} from '@deepseek-ai/dsh-tools'
import {
  Config,
  DEFAULT_PROVIDER_NAME,
  MANAGED_SKILL_RANK,
  SETTINGS_NS,
  SectionConfig,
  validateStoredSkill,
  type SkillsSection,
  type StoredSkill,
} from './skills.ts'
import { ManagedSkillProvider } from './provider.ts'
import { managerTools, statusOf, type SkillStatus, type SkillsPort } from './tools.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'skills-manager'

/** Services required before the plugin activates. */
export const inject = ['skills', 'tools']

/** Schemastery schema for the composition entry. */
export { Config, SETTINGS_NS }

/** Registry value shape re-exported for tools, tests, and downstream consumers. */
export type { SkillsSection, StoredSkill } from './skills.ts'

/** Status shape re-exported for the card and downstream consumers. */
export type { SkillStatus } from './tools.ts'

/**
 * Register the manager: install the registry section, publish the provider,
 * expose the management tools, and invalidate the catalog on every change.
 * @param ctx - the host context the manager is mounted on.
 * @param config - the composition entry's registry, used as the settings base layer.
 */
export function apply(ctx: Context, config: Config = { skills: [] }): void {
  const providerName = config.providerName ?? DEFAULT_PROVIDER_NAME
  const configuredRank = config.rank ?? MANAGED_SKILL_RANK
  const rank = Number.isFinite(configuredRank) ? configuredRank : MANAGED_SKILL_RANK
  const toolsEnabled = config.tools ?? true

  let current: StoredSkill[] = [...config.skills]
  let readSource: () => SkillsSection = () => ({ skills: current })
  let settings: SettingsProvider | undefined
  // The registry builds its provider synchronously inside `registerProvider`
  // below, so the invalidation hook exists before any write can reach it.
  let invalidate!: () => void

  // The provider is registered synchronously in `apply`, as the registry
  // requires; it reads the mutable registry on every discovery and load, so a
  // change needs no re-registration — only the catalog invalidation below.
  ctx.skills.registerProvider((control) => {
    invalidate = () => { control.invalidate() }
    return new ManagedSkillProvider({
      providerName,
      rank,
      read: () => current,
      warn: (message) => { ctx.logger.warn(message) },
    })
  })

  const list = (): readonly SkillStatus[] => readSource().skills.map(statusOf)

  /**
   * Adopt the registry a source resolved and drop the catalog when it moved.
   * Comparing a JSON projection keeps a no-op write from waking every
   * consumer, while any real edit invalidates immediately rather than at the
   * next watch tick.
   */
  const sync = (section: SkillsSection): void => {
    const next = [...section.skills]
    const changed = JSON.stringify(next) !== JSON.stringify(current)
    current = next
    if (changed) invalidate()
  }

  const persist = async (next: StoredSkill[]): Promise<void> => {
    const previous = current
    current = next
    if (settings === undefined) {
      invalidate()
      return
    }
    try {
      await settings.update(SETTINGS_NS, { skills: next })
    } catch (error: unknown) {
      // A refused write leaves the document unchanged, so the cached registry
      // must not keep the optimistic value the caller saw rejected.
      current = previous
      invalidate()
      throw error
    }
    invalidate()
  }

  const upsert = async (skill: StoredSkill): Promise<void> => {
    const problems = validateStoredSkill(skill)
    if (problems.length > 0) throw new Error(`invalid skill "${skill.name}": ${problems.join('; ')}`)
    const next = current.filter(candidate => candidate.name !== skill.name)
    next.push(skill)
    await persist(next)
  }

  const remove = async (skillName: string): Promise<void> => {
    const next = current.filter(candidate => candidate.name !== skillName)
    if (next.length === current.length) return
    await persist(next)
  }

  const setEnabled = async (skillName: string, enabled: boolean): Promise<void> => {
    const target = current.find(candidate => candidate.name === skillName)
    if (target === undefined || (target.enabled !== false) === enabled) return
    await persist(current.map(candidate => candidate.name === skillName ? { ...candidate, enabled } : candidate))
  }

  const port: SkillsPort = { list, upsert, remove, setEnabled }
  if (toolsEnabled) {
    for (const tool of managerTools(port)) ctx.tools.register(tool)
  }

  // The settings section is optional: a deployment without a provider keeps
  // running on the composition entry, and the card reports itself unavailable.
  ctx.inject(['settings'], (settingsCtx) => {
    settings = settingsCtx.settings
    settingsCtx.settings.installSection(ctx, SETTINGS_NS, SectionConfig, { skills: current }, {
      setSource: (source) => {
        readSource = source
        sync(source())
      },
      onChange: () => { sync(readSource()) },
    })
    ctx.effect(() => () => {
      settings = undefined
    }, 'skills-manager.settings-source')
  })
}
