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
/** One skill a source offers, as the import dialog lists it. */
export interface ImportCandidateView {
    /** Kebab-case name the registry will use. */
    readonly name: string;
    /** Routing description, or empty when the source's SKILL.md was unreadable. */
    readonly description: string;
    /** Directory the skill was read from. */
    readonly directory: string;
    /** Files the install would write. */
    readonly files: number;
    /** Bytes the install would write. */
    readonly bytes: number;
    /** Files a limit skipped, so a partial copy is visible before installing. */
    readonly dropped: number;
    /** Whether the copy looks like a vendored snapshot of another skill. */
    readonly vendored: boolean;
    /** Why it cannot be installed, as the host reported it; empty when it can. */
    readonly problems: readonly string[];
    /** Whether the user ticked it. */
    readonly selected: boolean;
}
/** Everything one source offered, as the dialog shows it. */
export interface ImportListingView {
    /** The URL or archive name that was read. */
    readonly source: string;
    /** `owner/repo`, when the source was a repository. */
    readonly repository?: string;
    /** The ref that was resolved. */
    readonly ref?: string;
    /** Whether the source was truncated, which makes the listing partial. */
    readonly truncated: boolean;
    /** The skills to offer. */
    readonly skills: readonly ImportCandidateView[];
    /** Directories that looked like skills but lost a name collision. */
    readonly skipped: readonly {
        readonly directory: string;
        readonly reason: string;
    }[];
}
/** The last refusal, in the two pieces the dialog shows. */
export interface ImportErrorView {
    /** What to tell the user, in their language. */
    readonly key: SkillsManagerKey;
    /** The host's own detail, shown muted below; empty when it adds nothing. */
    readonly detail: string;
}
/** An archive the user picked, already read for upload. */
export interface StagedArchive {
    /** The file's name, recorded as provenance. */
    readonly name: string;
    /** The file's bytes, base64-encoded for the JSON request. */
    readonly base64: string;
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
    /** Whether the import dialog is showing. */
    importOpen: boolean;
    /** Whether the dialog is reading a source or installing, so the buttons lock. */
    importBusy: boolean;
    /** The repository URL or shorthand the user typed. */
    importSource: string;
    /** An optional directory inside the repository to narrow to. */
    importSubdirectory: string;
    /** The archive the user picked; null while importing from a repository. */
    importArchive: StagedArchive | null;
    /** The preview listing, once one arrived; null before the first read. */
    importListing: ImportListingView | null;
    /** The last refusal, or null when the last call succeeded. */
    importError: ImportErrorView | null;
    /** What the last install did, so the dialog can confirm it. */
    importResult: {
        readonly installed: number;
        readonly skipped: readonly string[];
    } | null;
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
    /** Open the import dialog on a clean slate. */
    openImport(): void;
    /** Close the import dialog, discarding the preview and the staged archive. */
    closeImport(): void;
    /** Stage the repository URL the user typed. */
    setImportSource(text: string): void;
    /** Stage the directory narrowing. */
    setImportSubdirectory(text: string): void;
    /** Stage a picked archive, replacing any repository source. */
    setImportArchive(archive: StagedArchive | null): void;
    /** Tick or untick one previewed skill. */
    toggleImportName(name: string): void;
    /** Read the staged source and show what it offers. */
    previewImport(): void;
    /** Install every ticked skill. */
    installImport(): void;
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
/** The HTTP carrier the import dialog posts over; injectable so the controller is testable. */
export type ImportFetch = (input: string, init?: RequestInit) => Promise<Response>;
/**
 * Map a host problem code onto what the user should be told.
 *
 * The card never shows the host's raw code: a beginner needs to know whether to
 * re-check the link, wait, or sign in, and each of those is a different
 * sentence. The host's own message is kept beside it as muted detail, because
 * it is the only thing that names the actual cause.
 * @param problem - the stable code the route answered with.
 * @returns the dictionary key for that cause.
 */
export declare function importProblemKey(problem: string): SkillsManagerKey;
/** Bridges the `skills-manager` settings scope onto the card's snapshot. */
export declare class SkillsManagerCardController {
    private readonly scope;
    private readonly fetcher;
    private readonly store;
    private readonly unsubscribe;
    /**
     * The import request currently on the wire. Closing the dialog aborts it, and
     * a request that is no longer this one drops its own answer: a host that
     * answers slowly must not resurrect a dialog the user has already dismissed.
     */
    private inflight;
    /**
     * @param scope - the bound settings scope for the `skills-manager` namespace.
     * @param fetcher - HTTP carrier for the host import route.
     */
    constructor(scope: SettingsScope<SkillsManagerSettings>, fetcher?: ImportFetch);
    /** Release the scope subscription and any read still on the wire. */
    dispose(): void;
    /** Cancel the in-flight import request, if any. */
    private abortImport;
    /**
     * Build the face the card's slot registration injects.
     * @returns the card's snapshot store and its gesture actions.
     */
    inject(): SkillsManagerCardFace;
    /** Ask the host what the staged source offers, and show it. */
    private read;
    /** Install every ticked skill from the staged source. */
    private import;
    /** The staged source as request fields, or undefined when the user staged nothing usable. */
    private requestBody;
    /**
     * Post one import request and decode the answer, turning any failure into a
     * view.
     * @param body - the request the dialog staged.
     * @returns the decoded answer, or undefined when the request was superseded
     * (the dialog closed, or a newer request replaced it) and has nothing to say.
     */
    private post;
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