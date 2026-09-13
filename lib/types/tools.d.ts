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
/**
 * Build the management tools for one registry port.
 * @param port - the live registry the tools read and mutate.
 * @returns registry-ready tool definitions, in a stable order.
 */
export declare function managerTools(port: SkillsPort): ToolDefinition[];
/**
 * Project one stored skill onto the status the tools and the card report.
 * @param skill - the stored skill to describe.
 * @returns its enabled state, invocation policy, size, and any problems.
 */
export declare function statusOf(skill: StoredSkill): SkillStatus;
//# sourceMappingURL=tools.d.ts.map