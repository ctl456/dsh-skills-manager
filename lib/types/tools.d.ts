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
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { type StoredSkill } from './skills.ts';
import type { SourceListing } from './source.ts';
/** Live status of one managed skill, as reported to the model and the card. */
export interface SkillStatus {
    /** Kebab-case skill name. */
    readonly name: string;
    /** Routing description shown in the session catalog. */
    readonly description: string;
    /** Optional extra routing guidance. */
    readonly whenToUse?: string;
    /** Whether the provider publishes this entry. */
    readonly enabled: boolean;
    /** Whether the model's session catalog includes it. */
    readonly modelInvocable: boolean;
    /** Whether the user-facing slash catalog includes it. */
    readonly userInvocable: boolean;
    /** Instruction-body length, so a caller can see how large the skill is. */
    readonly characters: number;
    /** Reasons this entry is not publishable; empty when it is. */
    readonly problems: readonly string[];
}
/** The registry operations the tools and the card both drive. */
export interface SkillsPort {
    /** @returns the current status of every managed skill, in registry order. */
    list(): readonly SkillStatus[];
    /** Add a skill, or replace the entry with the same `name`. */
    upsert(skill: StoredSkill): Promise<void>;
    /** Remove the skill with this `name`; a missing name is a no-op. */
    remove(name: string): Promise<void>;
    /** Enable or disable one skill without changing its other fields. */
    setEnabled(name: string, enabled: boolean): Promise<void>;
}
/** What one import tool call reports after writing. */
export interface ImportOutcome {
    /** The entries that were written and are now in the registry. */
    readonly installed: readonly SkillStatus[];
    /** Names that produced nothing, with the reason. */
    readonly skipped: readonly {
        readonly name: string;
        readonly reason: string;
    }[];
}
/**
 * Where a caller wants skills read from, in transport-neutral terms. Whoever
 * constructs an importer maps this onto a real source, so the model tool, the
 * card's HTTP route, and any future surface all describe an import the same way.
 */
export type ImportTarget = {
    /** A repository, or any URL the location parser understands. */
    readonly kind: 'github';
    /** The text the user typed or pasted. */
    readonly source: string;
    /** A directory inside the source to read instead of the whole thing. */
    readonly subdirectory?: string;
} | {
    /** An archive the caller already holds in memory. */
    readonly kind: 'archive';
    /** The archive's file name, recorded as provenance. */
    readonly name: string;
    /** The archive's bytes. */
    readonly bytes: Uint8Array;
};
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
    preview(target: ImportTarget): Promise<SourceListing>;
    /**
     * Install the chosen skills from a target.
     * @param target - the repository or archive to read.
     * @param names - the skill names to install.
     * @returns the installed statuses and the names that produced nothing.
     */
    install(target: ImportTarget, names: readonly string[]): Promise<ImportOutcome>;
}
/**
 * Build the management tools for one registry port.
 * @param port - the live registry the tools read and mutate.
 * @param importer - the source importer; omit it to leave the import tool unregistered.
 * @returns registry-ready tool definitions, in a stable order.
 */
export declare function managerTools(port: SkillsPort, importer?: ImportPort): ToolDefinition[];
/**
 * Project one stored skill onto the status the tools and the card report.
 * @param skill - the stored skill to describe.
 * @returns its enabled state, invocation policy, size, and any problems.
 */
export declare function statusOf(skill: StoredSkill): SkillStatus;
//# sourceMappingURL=tools.d.ts.map