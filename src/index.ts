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

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
// Type-only: also resolves the `ctx.skills` Context augmentation.
import type { SkillResourceBase } from '@deepseek-ai/dsh-skill'
// Type-only: resolves the `ctx.tools` Context augmentation.
import type {} from '@deepseek-ai/dsh-tools'
import {
  Config,
  DEFAULT_PROVIDER_NAME,
  MANAGED_FILES_DIR,
  MANAGED_SKILL_RANK,
  SETTINGS_NS,
  SectionConfig,
  validateStoredSkill,
  type SkillsSection,
  type StoredSkill,
} from './skills.ts'
import { ManagedSkillProvider } from './provider.ts'
import { removeSkillFiles, type InstallFs } from './install.ts'
import { DEFAULT_LIMITS } from './discovery.ts'
import { installSkills, listSkills, type SkillSource } from './source.ts'
import { importRoute, SKILLS_IMPORT_PATH } from './route.ts'
import { managerTools, statusOf, type ImportOutcome, type ImportPort, type ImportTarget, type SkillStatus, type SkillsPort } from './tools.ts'

/** The slice of the Web connection service the import route registers on. */
interface SkillsImportConnection {
  /** Exact Fetch routes on the shared authenticated `/api` channel. */
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly string[]
      readonly requestBody: 'buffered'
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

/** Filesystem operations an install and a removal need; `node:fs/promises` satisfies it. */
const managerFs: InstallFs = {
  mkdir: (path, options) => mkdir(path, options),
  writeFile: (path, data) => writeFile(path, data),
  rm: (path, options) => rm(path, options),
}

/**
 * Absolute root holding every imported skill's files.
 *
 * Deliberately a sibling of the harness home's `skills` directory rather than
 * inside it: the shipped filesystem provider scans `<home>/skills` recursively
 * and would publish every imported skill a second time, under a second
 * provenance, which is exactly the duplicate the registry then has to rank.
 * @returns the absolute directory the manager owns.
 */
function managedRoot(): string {
  return dshHomePath(MANAGED_FILES_DIR)
}

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
  const githubToken = config.githubToken

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
      // An imported skill keeps its `SKILL.md` body in the settings document but
      // its `references/`, `scripts/` and `assets/` on disk, so the body's
      // relative paths only resolve when the loaded definition names the
      // directory. A hand-written skill has no files and gets no base.
      resourceBaseOf: (skill): SkillResourceBase | undefined => skill.installed === undefined
        ? undefined
        : { kind: 'directory', path: join(managedRoot(), skill.installed.directory) },
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
    // The files go after the entry, so a refused settings write cannot leave a
    // live entry whose files were already deleted. A hand-written skill has no
    // directory, and removing one that is already gone is not an error.
    try {
      await removeSkillFiles({ root: managedRoot(), name: skillName, fs: managerFs })
    } catch (error: unknown) {
      ctx.logger.warn(`skills-manager: could not delete the files for "${skillName}": ${String(error)}`)
    }
  }

  const setEnabled = async (skillName: string, enabled: boolean): Promise<void> => {
    const target = current.find(candidate => candidate.name === skillName)
    if (target === undefined || (target.enabled !== false) === enabled) return
    await persist(current.map(candidate => candidate.name === skillName ? { ...candidate, enabled } : candidate))
  }

  const importer: ImportPort = {
    preview: (target) => listSkills(sourceOf(target), DEFAULT_LIMITS),
    async install(target, names) {
      const outcome = await installSkills({
        source: sourceOf(target),
        root: managedRoot(),
        names,
        fs: managerFs,
      })
      // Each entry is registered through the same port the card writes, so an
      // import that lands half-way still publishes the skills that did land.
      const installed: SkillStatus[] = []
      for (const skill of outcome.installed) {
        await upsert(skill)
        installed.push(statusOf(skill))
      }
      return { installed, skipped: outcome.skipped } satisfies ImportOutcome
    },
  }

  const port: SkillsPort = { list, upsert, remove, setEnabled }
  if (toolsEnabled) {
    for (const tool of managerTools(port, importer)) ctx.tools.register(tool)
  }

  // The card's import route is optional for the same reason the settings
  // section is: only a Web deployment composes a connection carrier. The
  // route answers on the same authenticated `/api` channel every other browser
  // feature uses, so the trust fence applies before this handler runs.
  ctx.inject(['connection'], (connectionCtx) => {
    const connection = Reflect.get(connectionCtx, 'connection') as SkillsImportConnection | undefined
    if (connection === undefined) return
    connectionCtx.effect(() => connection.fetch.register({
      path: SKILLS_IMPORT_PATH,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: (request) => importRoute(importer, request),
    }), 'skills-manager: import route')
  })

  /** Build one readable source from the importer's transport-neutral target. */
  function sourceOf(target: ImportTarget): SkillSource {
    if (target.kind === 'archive') return { kind: 'archive', name: target.name, bytes: target.bytes }
    return {
      kind: 'github',
      input: target.source,
      client: {
        fetch: (input, init) => globalThis.fetch(input, init),
        ...githubToken === undefined || githubToken.length === 0 ? {} : { token: githubToken },
      },
      ...target.subdirectory === undefined || target.subdirectory.length === 0
        ? {}
        : { subdirectory: target.subdirectory },
    }
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
