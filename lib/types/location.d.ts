/**
 * Parse what a user typed into a location the installer can read.
 *
 * People paste every shape GitHub offers — the repository page, a `/tree/`
 * branch, a `/tree/<branch>/<dir>` subdirectory, a `/blob/` file, a
 * `raw.githubusercontent.com` link, an `owner/repo` shorthand, or an scp-style
 * clone URL — and the referenced repositories disagree about where a skill
 * lives. This module answers only "which repository, which ref, which path";
 * finding the skills is {@link ./discovery.ts}.
 *
 * @module @ctl456/dsh-skills-manager/location
 */
/** Why a typed location could not be turned into a repository pointer. */
export type LocationProblem = 
/** The input was empty or only whitespace. */
'empty'
/** The input is a URL, but not one this installer can read. */
 | 'unsupported-host'
/** The input looks like a path but does not name `<owner>/<repo>`. */
 | 'malformed'
/** The input points at a single file that is not a `SKILL.md`. */
 | 'not-a-skill-file';
/** A GitHub repository the installer can read through the REST API. */
export interface GitHubLocation {
    /** Discriminator for the location union. */
    readonly kind: 'github';
    /** Repository owner, the first path segment. */
    readonly owner: string;
    /** Repository name, without a trailing `.git`. */
    readonly repo: string;
    /** Explicit ref from a `/tree/` or `/blob/` URL; absent means the default branch. */
    readonly ref?: string;
    /** Directory the user scoped to; absent means the whole repository. */
    readonly subpath?: string;
    /** File the user linked directly; only a `SKILL.md` is meaningful here. */
    readonly file?: string;
    /** Canonical browsable URL, kept for provenance and for the card to show. */
    readonly url: string;
}
/** The outcome of parsing one typed location. */
export type LocationResult = {
    readonly ok: true;
    readonly location: GitHubLocation;
} | {
    readonly ok: false;
    readonly problem: LocationProblem;
};
/** One way to split a repo-relative path into a ref and the path below it. */
export interface RefSplit {
    /** The candidate ref, as it would be passed to the API. */
    readonly ref: string;
    /** The repository-relative path below that ref; empty when the ref is the whole path. */
    readonly path: string;
}
/**
 * Parse a user-supplied repository location.
 *
 * Accepts `https://github.com/<owner>/<repo>`, a `/tree/<ref>[/<dir>]` or
 * `/blob/<ref>/<file>` URL, a `raw.githubusercontent.com` file URL, an
 * `owner/repo` shorthand, and `git@github.com:<owner>/<repo>.git`.
 * @param input - the raw text the user typed or pasted.
 * @returns the repository pointer, or why the text could not be read.
 */
export declare function parseLocation(input: string): LocationResult;
/**
 * Split a repository-relative path into the candidate ref/path pairs to try.
 *
 * `/tree/<a>/<b>/<c>` is ambiguous — the branch could be `a`, `a/b`, or the
 * whole thing could be a path on the default branch — and GitHub itself guesses
 * the same way. The resolver walks these longest-ref-first so a real branch
 * whose name contains a slash still wins over a directory of the same name.
 * @param ref - the ref segment the URL named, or undefined for the default branch.
 * @param rest - the path segments below the ref, already split on `/`.
 * @returns the splits to try, in the order the resolver should attempt them.
 */
export declare function refSplits(ref: string | undefined, rest: readonly string[]): RefSplit[];
/** Whether a path names a skill instruction file. */
export declare function isSkillFileName(path: string): boolean;
//# sourceMappingURL=location.d.ts.map