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
import type { SkillInvocationPolicy } from '@deepseek-ai/dsh-skill';
/** Why a `SKILL.md` could not be read as a skill. */
export type SkillDocumentProblem = 
/** The file has no leading `---` frontmatter block. */
'missing-frontmatter'
/** The frontmatter block is not a YAML mapping. */
 | 'invalid-frontmatter'
/** `name` is absent, or is not a kebab-case skill name. */
 | 'invalid-name'
/** `description` is absent or empty. */
 | 'missing-description'
/** An invocation flag is present but not a boolean. */
 | 'invalid-invocation';
/** The routing metadata a `SKILL.md` contributes to the registry. */
export interface SkillDocument {
    /** Kebab-case skill name from the frontmatter. */
    readonly name: string;
    /** One-line routing description. */
    readonly description: string;
    /** Optional extra routing guidance. */
    readonly whenToUse?: string;
    /** Resolved model and user invocation controls. */
    readonly invocation: SkillInvocationPolicy;
    /** Markdown body with the frontmatter block removed. */
    readonly content: string;
    /** The parsed frontmatter mapping, for callers that want to echo it. */
    readonly data: Readonly<Record<string, unknown>>;
}
/** The outcome of reading one `SKILL.md`. */
export type SkillDocumentResult = {
    readonly ok: true;
    readonly document: SkillDocument;
} | {
    readonly ok: false;
    readonly problem: SkillDocumentProblem;
};
/**
 * Parse one `SKILL.md` body into the registry's shape.
 * @param raw - the file's full text, frontmatter included.
 * @returns the skill, or the first reason it could not be read.
 */
export declare function parseSkillDocument(raw: string): SkillDocumentResult;
/**
 * Split a Markdown document into its YAML frontmatter and the body below it.
 * @param raw - the file's full text.
 * @returns the mapping and body, or undefined when the document has no frontmatter block.
 */
export declare function splitFrontmatter(raw: string): {
    data: Record<string, unknown>;
    body: string;
} | undefined;
//# sourceMappingURL=frontmatter.d.ts.map