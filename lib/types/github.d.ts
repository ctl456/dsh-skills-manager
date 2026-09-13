/**
 * Read a skill repository over the GitHub REST API.
 *
 * Two endpoints do all the work, chosen so an import costs as few rate-limited
 * requests as possible: one `git/trees/<ref>?recursive=1` call lists the whole
 * repository, and everything afterwards is fetched from
 * `raw.githubusercontent.com`, which serves file content without counting
 * against the API quota. That split is what makes a 197-skill repository like
 * `manyuegong33/r0crawl_skills` practical to import one skill out of.
 *
 * The `fetch` used here is injected rather than global, so the resolver is
 * testable against recorded responses and a deployment can supply its own
 * transport.
 *
 * @module @ctl456/dsh-skills-manager/github
 */
import type { RepoBlob } from './discovery.ts';
import { type GitHubLocation } from './location.ts';
/** How a GitHub read failed, in terms the card can turn into advice. */
export type GitHubProblem = 
/** The repository, ref, or file does not exist. */
'not-found'
/** The API refused because the caller exceeded the anonymous quota. */
 | 'rate-limited'
/** The API refused because the token is missing, expired, or lacks access. */
 | 'unauthorized'
/** The tree is too large for the API to return in one response. */
 | 'truncated'
/** The request never completed. */
 | 'network';
/** A failed GitHub read, carrying a problem code rather than a parsed message. */
export declare class GitHubError extends Error {
    /** Stable problem code callers branch on. */
    readonly problem: GitHubProblem;
    /** HTTP status when the failure came from a response. */
    readonly status: number | undefined;
    /**
     * @param problem - the classified failure.
     * @param message - a human-readable detail for the log.
     * @param status - the HTTP status, when there was one.
     */
    constructor(problem: GitHubProblem, message: string, status?: number);
}
/** The transport and credentials one import runs with. */
export interface GitHubClient {
    /** Fetch implementation to use; injected so tests and hosts can substitute one. */
    readonly fetch: typeof fetch;
    /** Optional token, sent as a bearer credential for private repositories and a higher quota. */
    readonly token?: string;
    /** Abort signal owned by the caller, so closing the card cancels the reads. */
    readonly signal?: AbortSignal;
}
/** A resolved repository tree. */
export interface ResolvedTree {
    /** The ref the tree was read at, a branch name or commit sha. */
    readonly ref: string;
    /** Every blob in the repository. */
    readonly blobs: readonly RepoBlob[];
    /** Whether GitHub truncated the listing, which makes discovery partial. */
    readonly truncated: boolean;
}
/**
 * Resolve a location to a tree.
 *
 * A `/tree/<a>/<b>` URL is ambiguous about where the ref ends, so each
 * candidate split is tried in turn and the first that resolves wins — the same
 * guess GitHub's own web UI makes. A location without an explicit ref reads the
 * repository's default branch.
 * @param location - the parsed repository pointer.
 * @param client - the transport and optional credentials.
 * @returns the ref and every blob at it.
 * @throws GitHubError when the repository, the ref, or the network fails.
 */
export declare function resolveTree(location: GitHubLocation, client: GitHubClient): Promise<ResolvedTree>;
/**
 * Read a text file at a ref.
 * @param location - the repository pointer, for owner and repo.
 * @param ref - the resolved ref.
 * @param path - repository-relative path.
 * @param client - the transport and optional credentials.
 * @returns the file's text.
 * @throws GitHubError when the file is missing or the read fails.
 */
export declare function readTextFile(location: GitHubLocation, ref: string, path: string, client: GitHubClient): Promise<string>;
/**
 * Read a binary file at a ref.
 * @param location - the repository pointer, for owner and repo.
 * @param ref - the resolved ref.
 * @param path - repository-relative path.
 * @param client - the transport and optional credentials.
 * @returns the file's bytes.
 * @throws GitHubError when the file is missing or the read fails.
 */
export declare function readBinaryFile(location: GitHubLocation, ref: string, path: string, client: GitHubClient): Promise<Uint8Array>;
//# sourceMappingURL=github.d.ts.map