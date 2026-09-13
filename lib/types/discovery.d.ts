/**
 * Turn a repository's file list into the skills it contains.
 *
 * Repositories do not agree on where a skill lives, and the shipped filesystem
 * provider only understands `<name>/SKILL.md` and `<name>.md`. The survey that
 * drove this module found, among sixteen popular skill repositories, all of:
 *
 *   - the whole repository is one skill (`SKILL.md` at the root, with the
 *     `references/`, `scripts/` and `templates/` it names beside it);
 *   - a container directory holds many (`skills/<name>/SKILL.md`);
 *   - each top-level directory is one (`<name>/SKILL.md`);
 *   - an agent-specific nest holds them (`plugins/<p>/skills/<name>/SKILL.md`,
 *     `.claude/skills/<name>/SKILL.md`);
 *   - a repository vendors copies of other skill repositories under a
 *     materials directory, so the same skill name appears more than once.
 *
 * Discovery is therefore a pure function of the blob list: find every
 * `SKILL.md`, decide which directory owns it, hand it the files below that
 * directory that no nested skill owns, and finally drop duplicate skill names
 * in favour of the copy closest to the repository root — the canonical one,
 * not a vendored or translated snapshot.
 *
 * This module never touches the network, so the layout rules are testable
 * against recorded trees.
 *
 * @module @ctl456/dsh-skills-manager/discovery
 */
/** One blob in a repository tree. */
export interface RepoBlob {
    /** Repository-relative path, always `/`-separated. */
    readonly path: string;
    /** Size in bytes as the tree API reported it. */
    readonly size: number;
}
/** Where a skill's directory sits relative to the repository root. */
export type SkillLayout = 
/** `SKILL.md` at the repository root: the repository is the skill. */
'repository'
/** `skills/<name>/SKILL.md`, the common multi-skill container. */
 | 'container'
/** `<name>/SKILL.md` directly under the root. */
 | 'collection'
/** Deeper, typically an agent-specific convention such as `plugins/**` or `.claude/skills/**`. */
 | 'nested';
/** One skill found in a repository, before its `SKILL.md` is fetched. */
export interface DiscoveredSkill {
    /** Directory holding the `SKILL.md`, repository-relative; empty for a root skill. */
    readonly directory: string;
    /** Repository-relative path of the `SKILL.md` itself. */
    readonly skillFile: string;
    /** Provisional name from the directory basename; the frontmatter name wins once fetched. */
    readonly slug: string;
    /** Which layout bucket the directory fell into. */
    readonly layout: SkillLayout;
    /** Files to download for this skill, excluding files a nested skill owns. */
    readonly files: readonly RepoBlob[];
    /** Total bytes of {@link files}. */
    readonly bytes: number;
    /** Files dropped by a limit, so the card can warn that the copy is partial. */
    readonly dropped: number;
    /**
     * Whether the directory looks like someone else's vendored snapshot — an
     * unpacked `<repo>-main/` archive under a materials directory. Such a copy
     * still imports, but the card labels it so a user picking between two rows
     * with the same name can see which is canonical.
     */
    readonly vendored: boolean;
}
/** Caps that keep one import from pulling a whole monorepo. */
export interface DiscoveryLimits {
    /** Largest single file to include. */
    readonly maxFileBytes: number;
    /** Largest total payload for one skill. */
    readonly maxSkillBytes: number;
    /** Largest number of files for one skill. */
    readonly maxFiles: number;
}
/** Default caps: generous for real skills, far below a monorepo's weight. */
export declare const DEFAULT_LIMITS: DiscoveryLimits;
/**
 * Whether a path is furniture the importer should ignore.
 * @param path - repository-relative path.
 * @returns true when no skill content lives at that path.
 */
export declare function isNoisePath(path: string): boolean;
/**
 * Enumerate the skills in a repository tree.
 * @param blobs - every blob the tree API returned.
 * @param options - the user's scoped subpath and the payload caps.
 * @returns the skills to offer, ordered by directory.
 */
export declare function discoverSkills(blobs: readonly RepoBlob[], options?: {
    readonly subpath?: string;
    readonly limits?: DiscoveryLimits;
}): DiscoveredSkill[];
/**
 * Keep one skill per name, preferring the copy closest to the repository root.
 *
 * A duplicate is normally a vendored snapshot or a translation of the same
 * skill; the canonical copy is the shallowest one, and a copy under a
 * materials or vendor directory loses to one that is not, however deep it sits.
 * @param skills - discovered skills with their resolved names.
 * @returns the survivors, in their original order.
 */
export declare function dedupeByName<T extends {
    readonly name: string;
    readonly directory: string;
}>(skills: readonly T[]): {
    readonly kept: T[];
    readonly dropped: T[];
};
//# sourceMappingURL=discovery.d.ts.map