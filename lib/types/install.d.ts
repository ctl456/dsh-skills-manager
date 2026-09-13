/**
 * Write an imported skill's files beside its body.
 *
 * A managed skill keeps its instructions in the settings document, but the
 * `references/`, `scripts/` and `assets/` those instructions name have to exist
 * on disk for the model to resolve them, so an import materialises them under
 * one directory per skill. Everything here treats the repository as untrusted:
 * target paths are re-derived from the skill's own directory, any path that
 * escapes it is refused rather than sanitised, and a re-install clears the old
 * directory so a file the upstream repository deleted cannot linger and shadow
 * a stale instruction.
 *
 * The filesystem is injected so the whole module is testable without touching
 * a real disk.
 *
 * @module @ctl456/dsh-skills-manager/install
 */
import type { DiscoveredSkill } from './discovery.ts';
import type { InstalledFiles } from './skills.ts';
/** The filesystem operations an install needs. `node:fs/promises` satisfies it. */
export interface InstallFs {
    /** Create a directory, parents included. */
    mkdir(path: string, options: {
        recursive: true;
    }): Promise<string | undefined>;
    /** Write one file, replacing any existing content. */
    writeFile(path: string, data: Uint8Array): Promise<void>;
    /** Remove a directory and everything below it; a missing path is not an error. */
    rm(path: string, options: {
        recursive: true;
        force: true;
    }): Promise<void>;
}
/** One file to fetch from the source and write below the skill directory. */
export interface InstallFile {
    /** Repository-relative path to read. */
    readonly source: string;
    /** Path to write, relative to the skill's own directory. */
    readonly target: string;
    /** Size as the tree reported it, used for the written total. */
    readonly size: number;
}
/** Why an install could not be staged. */
export type InstallProblem = 
/** The skill name would not produce a directory this installer owns. */
'unsafe-name'
/** A file's path would land outside the skill's directory. */
 | 'unsafe-path';
/** The outcome of staging an install. */
export type InstallPlanResult = {
    readonly ok: true;
    readonly files: readonly InstallFile[];
} | {
    readonly ok: false;
    readonly problem: InstallProblem;
};
/**
 * Resolve the absolute directory one skill's files live in.
 * @param root - the absolute root holding every imported skill.
 * @param name - the skill name, which is also the directory name.
 * @returns the absolute directory, or undefined when the name is unusable.
 */
export declare function skillDirectory(root: string, name: string): string | undefined;
/**
 * Derive the files to write for one discovered skill.
 *
 * Each target is the file's path below the skill's own directory, so a skill at
 * `skills/x` writes `SKILL.md` and `scripts/a.js` rather than reproducing
 * `skills/x/scripts/a.js`. That keeps a repository's layout out of the managed
 * root and keeps a relocated skill's internal relative paths correct.
 * @param skill - the discovered skill, whose directory is repository-relative.
 * @returns the staged files, or the first reason the plan is unsafe.
 */
export declare function planInstall(skill: DiscoveredSkill): InstallPlanResult;
/**
 * Write one skill's files, replacing whatever the previous install left.
 * @param options - the managed root, the skill, its staged files, how to read a source file, and the filesystem.
 * @returns what was written, for the settings document.
 * @throws Error when the skill name or a staged path is unsafe.
 */
export declare function installSkillFiles(options: {
    readonly root: string;
    readonly name: string;
    readonly files: readonly InstallFile[];
    readonly read: (source: string) => Promise<Uint8Array>;
    readonly fs: InstallFs;
}): Promise<InstalledFiles>;
/**
 * Delete one skill's files.
 *
 * A skill's settings entry and its files are removed separately, so this is
 * deliberately forgiving: a directory that is already gone is the common case
 * for a hand-written skill and must not fail the removal.
 * @param options - the managed root, the skill name, and the filesystem.
 * @returns whether a directory was removed.
 */
export declare function removeSkillFiles(options: {
    readonly root: string;
    readonly name: string;
    readonly fs: InstallFs;
}): Promise<boolean>;
//# sourceMappingURL=install.d.ts.map