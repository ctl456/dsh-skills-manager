/**
 * Turn "somewhere a skill lives" into registry entries.
 *
 * Three things have to agree for an import to work: what the user pointed at
 * (a repository URL or a downloaded archive), which directories in it are
 * skills (that is {@link ./discovery.ts}), and what each one calls itself (that
 * is the `SKILL.md` frontmatter, which the repository layout cannot be trusted
 * to reflect). This module joins them and is the only place that knows both a
 * GitHub tree and a zip end up in the same shape.
 *
 * Listing and installing are separate calls on purpose. Listing is what the
 * card shows before anything is written — the real name, the description, how
 * many files and bytes would land on disk — and installing re-reads the source
 * rather than trusting a listing that a caller could have edited.
 *
 * @module @ctl456/dsh-skills-manager/source
 */
import { type ArchiveProblem } from './archive.ts';
import { type DiscoveryLimits, type SkillLayout } from './discovery.ts';
import { type GitHubClient, type GitHubProblem } from './github.ts';
import { type InstallFs, type InstallProblem } from './install.ts';
import { type LocationProblem } from './location.ts';
import { type SkillOriginKind, type StoredSkill } from './skills.ts';
/** Everything that can go wrong before a skill is written. */
export type ImportProblem = LocationProblem | GitHubProblem | ArchiveProblem | InstallProblem
/** The source was read, but held no directory that looks like a skill. */
 | 'no-skills'
/** The caller asked for a name the source does not offer. */
 | 'unknown-skill';
/** A failed import, carrying a code the card can turn into advice. */
export declare class ImportError extends Error {
    /** Stable problem code callers branch on. */
    readonly problem: ImportProblem;
    /**
     * @param problem - the classified failure.
     * @param message - a human-readable detail for the log and the card.
     */
    constructor(problem: ImportProblem, message: string);
}
/** Where a skill is being read from. */
export type SkillSource = {
    /** A GitHub repository, or any URL {@link parseLocation} understands. */
    readonly kind: 'github';
    /** The text the user typed or pasted. */
    readonly input: string;
    /**
     * A directory to narrow to, appended to whatever the URL already scoped.
     * A separate field because a user pasting a repository root and one
     * clicking a tree link should reach the same code with the same result.
     */
    readonly subdirectory?: string;
    /** Transport and optional credentials for the GitHub reads. */
    readonly client: GitHubClient;
} | {
    /** A zip the caller already has in memory. */
    readonly kind: 'archive';
    /** The archive's file name, recorded as provenance. */
    readonly name: string;
    /** The archive's bytes. */
    readonly bytes: Uint8Array;
};
/** One skill a source offers, as the preview reports it. */
export interface SourceCandidate {
    /** The name the registry will use: frontmatter first, directory slug as a fallback. */
    readonly name: string;
    /** One-line routing description from the frontmatter; empty when unreadable. */
    readonly description: string;
    /** Optional extra routing guidance from the frontmatter. */
    readonly whenToUse?: string;
    /** Repository-relative directory holding the `SKILL.md`; empty for a root skill. */
    readonly directory: string;
    /** Which layout bucket the directory fell into. */
    readonly layout: SkillLayout;
    /** Files this skill would write. */
    readonly files: number;
    /** Total bytes this skill would write. */
    readonly bytes: number;
    /** Files a discovery limit skipped, so a partial copy is visible before install. */
    readonly dropped: number;
    /** Whether the copy looks like a vendored snapshot of another skill. */
    readonly vendored: boolean;
    /** Whether the model's session catalog would include it. */
    readonly modelInvocable: boolean;
    /** Whether the user-facing slash catalog would include it. */
    readonly userInvocable: boolean;
    /** Why this skill cannot be installed; empty when it can. */
    readonly problems: readonly string[];
}
/** Everything one source offers, before anything is written. */
export interface SourceListing {
    /** Which installer produced this listing. */
    readonly kind: SkillOriginKind;
    /** The URL the user supplied, or the archive's file name. */
    readonly source: string;
    /** `owner/repo` for a GitHub import; absent for an archive. */
    readonly repository?: string;
    /** The ref that was resolved, a branch name or a commit sha. */
    readonly ref?: string;
    /** The directory the user scoped to; empty when the whole source was read. */
    readonly directory: string;
    /** Whether the source was truncated, which makes the listing partial. */
    readonly truncated: boolean;
    /** The skills to offer, in directory order. */
    readonly skills: readonly SourceCandidate[];
    /** Directories that looked like skills but lost a name collision. */
    readonly skipped: readonly {
        readonly directory: string;
        readonly reason: string;
    }[];
}
/** The outcome of installing the names a caller chose. */
export interface InstallOutcome {
    /** The registry entries to persist, in the order they were requested. */
    readonly installed: readonly StoredSkill[];
    /** Names that produced nothing, with the reason. */
    readonly skipped: readonly {
        readonly name: string;
        readonly reason: string;
    }[];
}
/**
 * List the skills a source offers without writing anything.
 * @param source - the repository URL or archive to read.
 * @param limits - discovery ceilings; defaults to {@link DEFAULT_LIMITS}.
 * @returns the listing, ready for the card or the model to show.
 * @throws ImportError when the source cannot be read at all.
 */
export declare function listSkills(source: SkillSource, limits?: DiscoveryLimits): Promise<SourceListing>;
/**
 * Install the named skills from a source onto disk.
 *
 * The source is read again rather than trusting a previous listing, so a
 * repository that changed between the preview and the confirmation installs
 * what is actually there. Every chosen skill is written before any entry is
 * returned; a caller that fails halfway still sees the entries for the skills
 * that did land, because the files and the settings document are updated
 * separately.
 * @param options - the source, the managed root, the chosen names, and the filesystem.
 * @returns the registry entries to persist, plus the names that produced nothing.
 * @throws ImportError when the source itself cannot be read.
 */
export declare function installSkills(options: {
    readonly source: SkillSource;
    readonly root: string;
    readonly names: readonly string[];
    readonly fs: InstallFs;
    readonly limits?: DiscoveryLimits;
    readonly now?: () => Date;
}): Promise<InstallOutcome>;
//# sourceMappingURL=source.d.ts.map