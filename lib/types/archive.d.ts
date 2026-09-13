/**
 * Read a downloaded skill archive.
 *
 * A `.zip` is the second way a skill reaches the manager: people package a
 * skill directory, or an agent host exports one, and there is no repository to
 * walk. Unpacking happens in memory and produces the same `RepoBlob` shape the
 * GitHub tree reader produces, so one discovery pass serves both sources and a
 * skill behaves identically however it arrived.
 *
 * An archive is untrusted input, so the reader refuses rather than repairs:
 * directories, macOS resource forks and the usual editor noise are dropped
 * before decompression, entry count and total size are capped so a zip bomb
 * cannot exhaust the host, and a single wrapping folder — what GitHub's own
 * "Download ZIP" adds — is stripped so a packaged repository keeps the layout
 * its author wrote.
 *
 * @module @ctl456/dsh-skills-manager/archive
 */
import { type RepoBlob } from './discovery.ts';
/** One readable file inside an archive. */
export interface ArchiveEntry {
    /** Archive-relative path with any single wrapping folder removed. */
    readonly path: string;
    /** Uncompressed size in bytes. */
    readonly size: number;
    /** Uncompressed bytes, kept in memory for the install that follows. */
    readonly data: Uint8Array;
}
/** Ceilings that keep a hostile archive from exhausting the host. */
export interface ArchiveLimits {
    /** Largest number of files to keep. */
    readonly maxEntries: number;
    /** Largest total uncompressed payload to keep. */
    readonly maxTotalBytes: number;
}
/** Default ceilings: generous for real skills, small next to a zip bomb. */
export declare const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits;
/** Why an archive could not be read as a skill source. */
export type ArchiveProblem = 
/** The bytes are not a readable zip. */
'unreadable'
/** The archive held no usable files. */
 | 'empty'
/** The archive exceeded an {@link ArchiveLimits} ceiling, so it was refused whole. */
 | 'too-large';
/** The outcome of reading an archive. */
export type ArchiveResult = {
    readonly ok: true;
    readonly entries: readonly ArchiveEntry[];
    /** The wrapping folder that was stripped, empty when there was none. */
    readonly root: string;
    /** Files skipped by an {@link ArchiveLimits} ceiling or by noise filtering. */
    readonly dropped: number;
} | {
    readonly ok: false;
    readonly problem: ArchiveProblem;
};
/**
 * Unpack a zip archive into the repository-shaped entries discovery consumes.
 * @param bytes - the archive's bytes, as downloaded or read from disk.
 * @param limits - the ceilings to enforce; defaults to {@link DEFAULT_ARCHIVE_LIMITS}.
 * @returns the usable entries and the stripped root, or why the archive was refused.
 */
export declare function readArchive(bytes: Uint8Array, limits?: ArchiveLimits): ArchiveResult;
/**
 * Project archive entries onto the blob shape a tree walk produces.
 * @param entries - the entries {@link readArchive} returned.
 * @returns one blob per entry, carrying its uncompressed size.
 */
export declare function archiveBlobs(entries: readonly ArchiveEntry[]): RepoBlob[];
//# sourceMappingURL=archive.d.ts.map