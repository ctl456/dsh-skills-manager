/**
 * Model-facing management tools. The model can list the managed skill
 * registry and add, remove, enable, or disable an entry; every mutation goes
 * through the same port the browser card writes, so chat and UI edits cannot
 * diverge.
 *
 * The tools only own the registry. Making a registered skill loadable is the
 * provider's job, so an added skill appears in the session catalog and loads
 * through the shipped `skill` tool with no extra wiring here.
 *
 * @module @ctl456/dsh-skills-manager/tools
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { invocationOf, validateStoredSkill, type StoredSkill } from './skills.ts'
import type { SourceListing } from './source.ts'

/** Live status of one managed skill, as reported to the model and the card. */
export interface SkillStatus {
  /** Kebab-case skill name. */
  readonly name: string
  /** Routing description shown in the session catalog. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** Whether the provider publishes this entry. */
  readonly enabled: boolean
  /** Whether the model's session catalog includes it. */
  readonly modelInvocable: boolean
  /** Whether the user-facing slash catalog includes it. */
  readonly userInvocable: boolean
  /** Instruction-body length, so a caller can see how large the skill is. */
  readonly characters: number
  /** Reasons this entry is not publishable; empty when it is. */
  readonly problems: readonly string[]
}

/** The registry operations the tools and the card both drive. */
export interface SkillsPort {
  /** @returns the current status of every managed skill, in registry order. */
  list(): readonly SkillStatus[]
  /** Add a skill, or replace the entry with the same `name`. */
  upsert(skill: StoredSkill): Promise<void>
  /** Remove the skill with this `name`; a missing name is a no-op. */
  remove(name: string): Promise<void>
  /** Enable or disable one skill without changing its other fields. */
  setEnabled(name: string, enabled: boolean): Promise<void>
}

/** What one import tool call reports after writing. */
export interface ImportOutcome {
  /** The entries that were written and are now in the registry. */
  readonly installed: readonly SkillStatus[]
  /** Names that produced nothing, with the reason. */
  readonly skipped: readonly { readonly name: string; readonly reason: string }[]
}

/**
 * Where a caller wants skills read from, in transport-neutral terms. Whoever
 * constructs an importer maps this onto a real source, so the model tool, the
 * card's HTTP route, and any future surface all describe an import the same way.
 */
export type ImportTarget =
  | {
    /** A repository, or any URL the location parser understands. */
    readonly kind: 'github'
    /** The text the user typed or pasted. */
    readonly source: string
    /** A directory inside the source to read instead of the whole thing. */
    readonly subdirectory?: string
  }
  | {
    /** An archive the caller already holds in memory. */
    readonly kind: 'archive'
    /** The archive's file name, recorded as provenance. */
    readonly name: string
    /** The archive's bytes. */
    readonly bytes: Uint8Array
  }

/**
 * The import operations the model tool and the card's route both drive. The
 * host supplies this because only it knows where the managed files live and
 * which transport to fetch with; a deployment that cannot reach a source simply
 * omits it and the surfaces are not registered.
 */
export interface ImportPort {
  /**
   * Read a target without writing anything.
   * @param target - the repository or archive to read.
   * @returns every skill the target offers, with its real name and size.
   */
  preview(target: ImportTarget): Promise<SourceListing>
  /**
   * Install the chosen skills from a target.
   * @param target - the repository or archive to read.
   * @param names - the skill names to install.
   * @returns the installed statuses and the names that produced nothing.
   */
  install(target: ImportTarget, names: readonly string[]): Promise<ImportOutcome>
}

/** Tool output declaration shared by every management tool: pretty JSON text. */
interface JsonTextOutput {
  /** Canonical output kind: an arbitrary JSON value, not a tool-specific schema. */
  schema: { type: 'json' }
  /** Render the canonical value as indented JSON text for the model. */
  render(args: unknown, value: JsonValue): [{ type: 'text'; text: string }]
}

/** Build the shared pretty-JSON output declaration. */
function jsonOutput(): JsonTextOutput {
  return {
    schema: { type: 'json' },
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  }
}

/** Shared parameter description for the skill name. */
const NAME_DESCRIPTION =
  'Kebab-case skill name: lowercase letters, digits, and single hyphens '
  + '(for example "release-notes"). The model loads the skill by this exact name.'

/** Shared parameter description for the instruction body. */
const CONTENT_DESCRIPTION =
  'The skill body in Markdown: the instructions the model follows after loading it. '
  + 'Write the procedure, not a summary of it.'

/** Build a registry entry from one add call. */
function skillFromArgs(args: {
  readonly name: string
  readonly description: string
  readonly content: string
  readonly whenToUse?: string
  readonly disableModelInvocation?: boolean
  readonly userInvocable?: boolean
  readonly enabled?: boolean
}): StoredSkill {
  const whenToUse = args.whenToUse?.trim()
  return {
    name: args.name.trim(),
    description: args.description.trim(),
    ...whenToUse === undefined || whenToUse.length === 0 ? {} : { whenToUse },
    content: args.content,
    ...args.disableModelInvocation === undefined ? {} : { disableModelInvocation: args.disableModelInvocation },
    ...args.userInvocable === undefined ? {} : { userInvocable: args.userInvocable },
    ...args.enabled === undefined ? {} : { enabled: args.enabled },
  }
}

/**
 * Build the management tools for one registry port.
 * @param port - the live registry the tools read and mutate.
 * @param importer - the source importer; omit it to leave the import tool unregistered.
 * @returns registry-ready tool definitions, in a stable order.
 */
export function managerTools(port: SkillsPort, importer?: ImportPort): ToolDefinition[] {
  const list = defineTool({
    name: 'skills_manager_list',
    description:
      'List the agent skills managed by this harness with their enabled state, invocation policy, and any '
      + 'configuration problems. Skills discovered from project and user directories are not listed here; only '
      + 'the ones this manager owns. Use it before adding or removing a skill.',
    parameters: {},
    output: jsonOutput(),
    execute(): Promise<JsonValue> {
      return Promise.resolve({ skills: port.list() } as unknown as JsonValue)
    },
  })

  const add = defineTool({
    name: 'skills_manager_add',
    description:
      'Add an agent skill, or replace the entry with the same name. The harness publishes it immediately, so it '
      + 'appears in the available-skills catalog and can be loaded with the `skill` tool by that name. Give a '
      + 'kebab-case name, a one-line description that says when to use it, and the Markdown instructions to follow.',
    parameters: {
      name: { type: 'string', required: true, description: NAME_DESCRIPTION },
      description: { type: 'string', required: true, description: 'One line saying what the skill does and when to use it.' },
      content: { type: 'string', required: true, description: CONTENT_DESCRIPTION },
      whenToUse: { type: 'string', description: 'Optional extra routing guidance beyond the description.' },
      disableModelInvocation: { type: 'boolean', description: 'When true, hide the skill from the model catalog; defaults to false.' },
      userInvocable: { type: 'boolean', description: 'When false, hide the skill from the user slash catalog; defaults to true.' },
      enabled: { type: 'boolean', description: 'Whether to publish the skill now; defaults to true.' },
    },
    output: jsonOutput(),
    async execute(args): Promise<JsonValue> {
      await port.upsert(skillFromArgs(args))
      return { skills: port.list() } as unknown as JsonValue
    },
  })

  const remove = defineTool({
    name: 'skills_manager_remove',
    description: 'Remove a managed agent skill. It stops appearing in the skill catalog immediately and the stored entry is deleted.',
    parameters: {
      name: { type: 'string', required: true, description: NAME_DESCRIPTION },
    },
    output: jsonOutput(),
    async execute(args): Promise<JsonValue> {
      await port.remove(args.name)
      return { skills: port.list() } as unknown as JsonValue
    },
  })

  const setEnabled = defineTool({
    name: 'skills_manager_set_enabled',
    description:
      'Enable or disable a managed agent skill without deleting it. Disabling withdraws it from the skill catalog '
      + 'while keeping the stored body; enabling publishes it again.',
    parameters: {
      name: { type: 'string', required: true, description: NAME_DESCRIPTION },
      enabled: { type: 'boolean', required: true, description: 'True to publish the skill, false to withdraw it.' },
    },
    output: jsonOutput(),
    async execute(args): Promise<JsonValue> {
      await port.setEnabled(args.name, args.enabled)
      return { skills: port.list() } as unknown as JsonValue
    },
  })

  const tools = [list, add, remove, setEnabled]
  if (importer !== undefined) tools.push(importSkills(port, importer))
  return tools
}

/** Shared parameter description for the import source. */
const SOURCE_DESCRIPTION =
  'Where the skills live: a GitHub repository URL (https://github.com/<owner>/<repo>), a "/tree/<ref>/<dir>" '
  + 'link scoped to one directory, or the "<owner>/<repo>" shorthand.'

/** Shared parameter description for the directory narrowing. */
const SUBDIRECTORY_DESCRIPTION =
  'A directory inside the source to read instead of the whole thing, relative to the repository root '
  + '(for example "skills/rev-frida"). Narrow this when a repository holds many skills and only one is wanted.'

/** Build the import tool, which previews a source and then installs from it. */
function importSkills(port: SkillsPort, importer: ImportPort): ToolDefinition {
  return defineTool({
    name: 'skills_manager_import',
    description:
      'Install agent skills from a GitHub repository or a shared skill collection. Call it with only `source` '
      + 'first: it then returns every skill the source offers, with the real name from each SKILL.md, its '
      + 'description, and how many files and bytes it would write. Nothing is written on that call. Call it again '
      + 'with `skills` set to the names to install, and the harness downloads those skills\' files, registers them, '
      + 'and publishes them to the skill catalog so the `skill` tool can load them by name. A repository may hold '
      + 'one skill at its root, many under "skills/<name>/", or a custom layout; the listing resolves that.',
    parameters: {
      source: { type: 'string', required: true, description: SOURCE_DESCRIPTION },
      skills: {
        type: 'array',
        items: { type: 'string' },
        description: 'The names to install, as returned by a preview call. Omit the parameter to preview instead of installing.',
      },
      subdirectory: { type: 'string', description: SUBDIRECTORY_DESCRIPTION },
    },
    output: jsonOutput(),
    async execute(args): Promise<JsonValue> {
      const names = args.skills ?? []
      const target: ImportTarget = {
        kind: 'github',
        source: args.source,
        ...args.subdirectory === undefined ? {} : { subdirectory: args.subdirectory },
      }
      if (names.length === 0) {
        const listing = await importer.preview(target)
        return { mode: 'preview', listing } as unknown as JsonValue
      }
      const outcome = await importer.install(target, names)
      return {
        mode: 'install',
        installed: outcome.installed,
        skipped: outcome.skipped,
        skills: port.list(),
      } as unknown as JsonValue
    },
  })
}

/**
 * Project one stored skill onto the status the tools and the card report.
 * @param skill - the stored skill to describe.
 * @returns its enabled state, invocation policy, size, and any problems.
 */
export function statusOf(skill: StoredSkill): SkillStatus {
  const invocation = invocationOf(skill)
  const whenToUse = skill.whenToUse?.trim()
  return {
    name: skill.name,
    description: skill.description,
    ...whenToUse === undefined || whenToUse.length === 0 ? {} : { whenToUse },
    enabled: skill.enabled !== false,
    modelInvocable: invocation.modelInvocable,
    userInvocable: invocation.userInvocable,
    characters: skill.content.length,
    problems: validateStoredSkill(skill),
  }
}
