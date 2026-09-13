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
import z from '@deepseek-ai/schemastery';
import type { SkillCandidate, SkillDefinition, SkillInvocationPolicy, SkillResourceBase, SkillSource } from '@deepseek-ai/dsh-skill';
/** Settings namespace owning the managed skill registry. */
export declare const SETTINGS_NS = "skills-manager";
/** Provider name registered on `ctx.skills`; also the value the UI keys on. */
export declare const DEFAULT_PROVIDER_NAME = "skills-manager";
/**
 * Discovery rank of the managed provider. The shipped filesystem provider
 * ranks project roots at 100/200, `customSkillDirs` at 300, the user DSH root
 * at 400, the user agents root at 500, and bundled skills at 600 — so 350
 * keeps a repository's own skills authoritative while managed skills still
 * beat every user-level root.
 */
export declare const MANAGED_SKILL_RANK = 350;
/** Origin bucket recorded on every managed candidate, so the UI can identify its own rows. */
export declare const MANAGED_SKILL_SOURCE: SkillSource;
/** Longest accepted skill name; the registry grammar itself has no length bound. */
export declare const MAX_SKILL_NAME_LENGTH = 64;
/**
 * Directory under the Harness home that holds the files of imported skills.
 *
 * Imported skills keep their body in the settings document, but the
 * `references/`, `scripts/` and `assets/` their instructions name have to exist
 * on disk for the model to resolve them, so they land here — beside the
 * settings that describe them, and outside the user skill root the shipped
 * filesystem provider scans, so one skill is never published twice.
 */
export declare const MANAGED_FILES_DIR = "skills-manager";
/** Longest accepted provenance string; long enough for a URL with a query. */
export declare const MAX_ORIGIN_LENGTH = 2048;
/** Longest accepted routing description, matching what a session catalog can usefully render. */
export declare const MAX_DESCRIPTION_LENGTH = 1024;
/** Longest accepted extra routing guidance. */
export declare const MAX_WHEN_TO_USE_LENGTH = 1024;
/** Largest accepted instruction body, in UTF-16 code units. */
export declare const MAX_CONTENT_LENGTH = 262144;
/**
 * One persisted skill. Field names mirror the `SKILL.md` frontmatter keys the
 * filesystem provider parses: `disable-model-invocation` and `user-invocable`
 * become optional booleans whose defaults keep the skill available to both the
 * model and the user's slash catalog.
 */
export interface StoredSkill {
    /** Kebab-case identifier; the model addresses the skill by this name. */
    name: string;
    /** Short routing description shown in the session catalog. */
    description: string;
    /** Optional extra routing guidance. */
    whenToUse?: string;
    /** Markdown instruction body the model reads when it loads the skill. */
    content: string;
    /** When true, the skill is stored but hidden from the model catalog. */
    disableModelInvocation?: boolean;
    /** When false, the skill is hidden from the user-facing slash catalog. */
    userInvocable?: boolean;
    /** Whether the provider publishes this skill at all; defaults to true. */
    enabled?: boolean;
    /** Provenance for an imported skill; absent for one written by hand. */
    origin?: SkillOrigin;
    /** The files an import wrote beside the body; absent for a text-only skill. */
    installed?: InstalledFiles;
}
/** Which installer produced a skill, and therefore how to re-fetch it. */
export type SkillOriginKind = 'github' | 'archive';
/**
 * Where an imported skill came from. A skill written by hand has no origin at
 * all, which is what lets the card tell the two apart without a second field.
 */
export interface SkillOrigin {
    /** Which installer produced the entry. */
    readonly kind: SkillOriginKind;
    /** The URL the user supplied, or the archive's file name. */
    readonly source: string;
    /** `owner/repo` for a GitHub import. */
    readonly repository?: string;
    /** The ref that was resolved at install time, a branch name or a commit sha. */
    readonly ref?: string;
    /** Repository-relative directory the skill was read from. */
    readonly directory?: string;
    /** When the files were written, as an ISO-8601 instant. */
    readonly installedAt: string;
}
/** What the installer wrote to disk for one imported skill. */
export interface InstalledFiles {
    /** Directory name under {@link MANAGED_FILES_DIR}; always the skill name. */
    readonly directory: string;
    /** Number of files written. */
    readonly files: number;
    /** Total bytes written. */
    readonly bytes: number;
    /** Files a discovery limit skipped, so a partial copy is visible. */
    readonly dropped: number;
}
/** The settings-section value: the managed skill registry. */
export interface SkillsSection {
    /** Managed skills, in registration order. */
    skills: StoredSkill[];
}
/** Schemastery schema for the settings section and its composition base layer. */
export declare const SectionConfig: z<SkillsSection>;
/** Plugin configuration: the section schema plus the row's provider identity. */
export interface Config extends SkillsSection {
    /** Provider name registered on `ctx.skills`; defaults to `skills-manager`. */
    providerName?: string;
    /** Discovery rank; defaults to {@link MANAGED_SKILL_RANK}. */
    rank?: number;
    /** Whether to register the model-facing `skills_manager_*` tools; defaults to true. */
    tools?: boolean;
    /**
     * GitHub token used by `skills_manager_import`. Anonymous reads are limited to
     * 60 requests an hour per address, which a large repository can exhaust, and a
     * token is also what reaches a private repository. Absent reads anonymously.
     */
    githubToken?: string;
}
/** Schemastery schema for the composition entry. */
export declare const Config: z<Config>;
/**
 * Resolve a skill's invocation policy. Absent flags permit both audiences,
 * matching the filesystem provider's frontmatter defaults.
 * @param skill - the stored skill to project.
 * @returns the resolved model and user invocation controls.
 */
export declare function invocationOf(skill: StoredSkill): SkillInvocationPolicy;
/**
 * Report every reason a stored skill cannot be published. The registry rejects
 * a malformed candidate by throwing, which would fail the whole catalog, so the
 * provider filters on this list instead of handing it a bad entry.
 * @param skill - the stored skill to check.
 * @returns human-readable problems, empty when the entry is publishable.
 */
export declare function validateStoredSkill(skill: StoredSkill): string[];
/**
 * Project one stored skill onto the registry's candidate shape.
 * @param skill - a valid stored skill.
 * @param options - the provider name and discovery rank to stamp on the candidate.
 * @returns the candidate the registry merges; the locator is the skill name.
 */
export declare function toCandidate(skill: StoredSkill, options: {
    readonly providerName: string;
    readonly rank: number;
}): SkillCandidate;
/**
 * Project one stored skill onto a complete definition, body included.
 *
 * An imported skill also carries a resource base, which is how the shipped
 * `skill` tool tells the model where to resolve the relative paths the body
 * mentions — without it, a skill whose instructions say "run
 * `scripts/detect-patterns.js`" is unusable. A hand-written skill has no files
 * behind it, so it gets no base and the model is told the provider manages its
 * resources.
 * @param skill - a valid stored skill.
 * @param options - the provider name and discovery rank to stamp on the definition.
 * @param resourceBase - where this skill's files live, when it has any.
 * @returns the definition `ctx.skills.get()` resolves for this name.
 */
export declare function toDefinition(skill: StoredSkill, options: {
    readonly providerName: string;
    readonly rank: number;
}, resourceBase?: SkillResourceBase): SkillDefinition;
//# sourceMappingURL=skills.d.ts.map