/**
 * The skills card's controller: bridge the `skills-manager` settings scope
 * onto a small form model, and turn explicit user gestures (add, edit,
 * remove, enable, disable) into revision-fenced settings writes.
 *
 * The card acts directly instead of staging a save: adding, editing, or
 * removing a skill is a discrete gesture, and the settings scope already
 * orders and fences each write, so a separate save step would only risk
 * leaving the card out of sync with the document.
 *
 * Draft validation mirrors the Host's `validateStoredSkill`, including the
 * limits, because the card can only see the settings document — the Host's
 * publish decision is not on this transport. Rejecting a bad draft before the
 * write is what keeps the two views agreeing.
 *
 * @module @ctl456/dsh-skills-manager/client/card-controller
 */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client';
import type { SkillsManagerKey } from './locales.ts';
/** Settings namespace the card edits; the Host registers the same value. */
export declare const SKILLS_MANAGER_NS = "skills-manager";
/** Skills shown per page; the list pages instead of growing without bound. */
export declare const SKILLS_MANAGER_PAGE_SIZE = 5;
/** The registry's public skill-name grammar. */
export declare const SKILL_NAME_PATTERN: RegExp;
/** Longest accepted skill name, matching the Host's schema. */
export declare const MAX_SKILL_NAME_LENGTH = 64;
/** Longest accepted routing description, matching the Host's schema. */
export declare const MAX_DESCRIPTION_LENGTH = 1024;
/** Longest accepted extra routing guidance, matching the Host's schema. */
export declare const MAX_WHEN_TO_USE_LENGTH = 1024;
/** Largest accepted instruction body, matching the Host's schema. */
export declare const MAX_CONTENT_LENGTH = 262144;
/** One skill as stored in the settings section. */
export interface StoredSkill {
    /** Kebab-case identifier. */
    name: string;
    /** Routing description. */
    description: string;
    /** Optional extra routing guidance. */
    whenToUse?: string;
    /** Markdown instruction body. */
    content: string;
    /** When true, the model catalog excludes the skill. */
    disableModelInvocation?: boolean;
    /** When false, the slash catalog excludes the skill. */
    userInvocable?: boolean;
    /** Whether the Host publishes the skill; defaults to true. */
    enabled?: boolean;
}
/** The settings section value. */
export interface SkillsManagerSettings {
    /** Managed skills, in document order. */
    skills?: StoredSkill[];
}
/** A skill as the card lists it. */
export interface SkillView {
    /** Kebab-case identifier. */
    readonly name: string;
    /** Routing description. */
    readonly description: string;
    /** Whether the Host publishes it. */
    readonly enabled: boolean;
    /** Whether the model catalog includes it. */
    readonly modelInvocable: boolean;
    /** Whether the slash catalog includes it. */
    readonly userInvocable: boolean;
    /** Instruction-body length, shown so a large body is visible before opening it. */
    readonly characters: number;
    /** Reasons this stored entry is not publishable, as locale keys. */
    readonly problems: readonly SkillsManagerKey[];
}
/** The add/edit form's draft state. */
export interface DraftState {
    /** Skill name. */
    name: string;
    /** Routing description. */
    description: string;
    /** Optional extra routing guidance. */
    whenToUse: string;
    /** Markdown instruction body. */
    content: string;
    /** Whether the model catalog should include the skill. */
    modelInvocable: boolean;
    /** Whether the slash catalog should include the skill. */
    userInvocable: boolean;
}
/** The card's full render state. */
export interface SkillsManagerCardState {
    /** False while the Host does not serve the namespace; the card renders nothing. */
    available: boolean;
    /** Whether the Host document accepts writes. */
    writable: boolean;
    /** Whether a write is crossing the wire. */
    saving: boolean;
    /** Latest refusal, as a locale key; null when the last action succeeded. */
    error: SkillsManagerKey | null;
    /** Configured skills, in document order. */
    skills: readonly SkillView[];
    /** Current filter text; empty shows every skill. */
    query: string;
    /** How many skills match the current filter. */
    matched: number;
    /** Zero-based index of the visible page, clamped to `pageCount`. */
    page: number;
    /** Number of pages the filtered list spans; always at least 1. */
    pageCount: number;
    /** The current page's slice of the filtered skills. */
    visible: readonly SkillView[];
    /** Whether the add/edit dialog is showing. */
    dialogOpen: boolean;
    /** Name of the skill being edited; null while adding. */
    editing: string | null;
    /** The form's drafts. */
    draft: DraftState;
}
/** Editable draft fields. */
export type DraftField = 'name' | 'description' | 'whenToUse' | 'content';
/** The registration-side face the card's slot entry injects. */
export interface SkillsManagerCardFace {
    /** Card snapshot bound by the renderer as useSkillsManagerCard. */
    hooks: {
        skillsManagerCard: SnapshotStore<SkillsManagerCardState>;
    };
    /** Replace the filter text; the list jumps back to the first page. */
    setQuery(query: string): void;
    /** Show one page of the filtered list; out-of-range values clamp. */
    setPage(page: number): void;
    /** Open the add dialog with an empty draft. */
    openAdd(): void;
    /** Open the dialog on an existing skill's stored values. */
    openEdit(name: string): void;
    /** Close the dialog, discarding the staged draft. */
    closeDialog(): void;
    /** Stage draft text for one field. */
    edit(field: DraftField, text: string): void;
    /** Set the model-invocation draft flag. */
    setModelInvocable(modelInvocable: boolean): void;
    /** Set the user-invocation draft flag. */
    setUserInvocable(userInvocable: boolean): void;
    /** Validate and write the staged skill, then close the dialog on success. */
    submit(): void;
    /** Remove one configured skill. */
    remove(name: string): void;
    /** Enable or disable one configured skill. */
    setEnabled(name: string, enabled: boolean): void;
    /** Restore the form to the stored skill, or clear it while adding. */
    resetDraft(): void;
}
/** Project one stored skill onto the card's view, decoding defaults and diagnostics. */
export declare function toView(skill: StoredSkill): SkillView;
/** Whether one skill matches the filter text, which is case-insensitive over the name and description. */
export declare function matches(skill: SkillView, query: string): boolean;
/**
 * Validate a draft and project it onto a stored entry.
 * @param draft - the staged form text.
 * @returns the entry to write, or the first refusal as a locale key.
 */
export declare function draftToSkill(draft: DraftState): {
    skill: StoredSkill;
} | {
    error: SkillsManagerKey;
};
/** Bridges the `skills-manager` settings scope onto the card's snapshot. */
export declare class SkillsManagerCardController {
    private readonly scope;
    private readonly store;
    private readonly unsubscribe;
    /** @param scope - the bound settings scope for the `skills-manager` namespace. */
    constructor(scope: SettingsScope<SkillsManagerSettings>);
    /** Release the scope subscription. */
    dispose(): void;
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot store and its gesture actions.
     */
    inject(): SkillsManagerCardFace;
    /** Copy the resolved scope value onto the card state. */
    private project;
    /** The currently stored skills, verbatim, so a write round-trips untouched fields. */
    private stored;
    /** Validate and write the staged skill. */
    private submit;
    /**
     * Persist one skill list.
     * @param next - the complete next list for the namespace's `skills` field.
     * @returns whether the Host accepted the write.
     */
    private write;
}
//# sourceMappingURL=card-controller.d.ts.map