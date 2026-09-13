/**
 * The `SkillProvider` the manager registers on `ctx.skills`.
 *
 * Registering a provider is what makes a managed skill a first-class skill:
 * the registry merges this catalog with every other provider's, the session
 * catalog advertises the winners to the model, and the shipped `skill` tool
 * loads the body through here. Discovery re-reads the registry on every call,
 * so a body edited outside the manager needs no cache invalidation on this
 * side; the manager calls `control.invalidate()` after its own writes to drop
 * the registry's completed catalogs.
 *
 * @module @ctl456/dsh-skills-manager/provider
 */

import type {
  SkillCandidate,
  SkillDefinition,
  SkillLookupOptions,
  SkillProvider,
  SkillResourceBase,
} from '@deepseek-ai/dsh-skill'
import { toCandidate, toDefinition, validateStoredSkill, type StoredSkill } from './skills.ts'

/** What the provider needs to read the current registry and report bad entries. */
export interface ManagedSkillProviderOptions {
  /** Provider name the registry lists; also stamped on every candidate. */
  readonly providerName: string
  /** Discovery rank; lower wins a duplicate name. */
  readonly rank: number
  /** Read the current registry. Called on every discovery and every load. */
  readonly read: () => readonly StoredSkill[]
  /** Sink for one warning per skipped entry, so a typo is visible in the log. */
  readonly warn: (message: string) => void
  /**
   * Where one skill's files live, when it has any. The provider itself knows
   * nothing about the filesystem, so the host decides the root and this
   * callback keeps the mapping in one place.
   */
  readonly resourceBaseOf?: (skill: StoredSkill) => SkillResourceBase | undefined
}

/** Maps the manager's registry onto the skill registry's provider contract. */
export class ManagedSkillProvider implements SkillProvider {
  /** Provider name the registry merges under. */
  readonly name: string

  /** @param options - the registry reader, identity, rank, and warning sink. */
  constructor(private readonly options: ManagedSkillProviderOptions) {
    this.name = options.providerName
  }

  /**
   * List every publishable managed skill.
   *
   * Uninterpretable entries are logged and omitted rather than failing the
   * whole discovery: one bad row must not hide every other skill. The card and
   * `skills_manager_list` report the same rows as diagnostics, which is the
   * surface a human actually reads.
   * @param options - lookup options; discovery here needs no cwd and only observes cancellation.
   * @returns one candidate per enabled, valid entry.
   */
  list(options: SkillLookupOptions): Promise<readonly SkillCandidate[]> {
    // Discovery reads an in-memory registry, so the only asynchronous duty is
    // to report cancellation as a rejection rather than a synchronous throw.
    return Promise.resolve().then(() => {
      options.signal?.throwIfAborted()
      const candidates: SkillCandidate[] = []
      for (const skill of this.registry().values()) {
        if (skill.enabled === false) continue
        const problems = validateStoredSkill(skill)
        if (problems.length > 0) {
          this.options.warn(`skills-manager: ignoring "${skill.name}": ${problems.join('; ')}`)
          continue
        }
        candidates.push(toCandidate(skill, this.options))
      }
      return candidates
    })
  }

  /**
   * Load one managed skill's body.
   * @param candidate - the candidate this provider returned earlier.
   * @param options - lookup options; only cancellation is observed.
   * @returns the current definition, or undefined when the entry was removed,
   *   disabled, or became invalid since discovery.
   */
  get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined> {
    return Promise.resolve().then(() => {
      options.signal?.throwIfAborted()
      const skill = this.registry().get(candidate.name)
      if (skill === undefined || skill.enabled === false) return undefined
      if (validateStoredSkill(skill).length > 0) return undefined
      return toDefinition(skill, this.options, this.options.resourceBaseOf?.(skill))
    })
  }

  /**
   * The registry indexed by name, last entry winning. The manager keeps names
   * unique, but a hand-edited document may repeat one; indexing here means a
   * duplicate cannot produce two candidates the registry would have to rank,
   * and `get` resolves the same entry `list` published.
   * @returns every stored entry keyed by its skill name.
   */
  private registry(): Map<string, StoredSkill> {
    const byName = new Map<string, StoredSkill>()
    for (const skill of this.options.read()) byName.set(skill.name, skill)
    return byName
  }
}
