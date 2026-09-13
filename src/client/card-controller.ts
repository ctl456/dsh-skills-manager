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

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SkillsManagerKey } from './locales.ts'

/** Settings namespace the card edits; the Host registers the same value. */
export const SKILLS_MANAGER_NS = 'skills-manager'

/** Skills shown per page; the list pages instead of growing without bound. */
export const SKILLS_MANAGER_PAGE_SIZE = 5

/** The registry's public skill-name grammar. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Longest accepted skill name, matching the Host's schema. */
export const MAX_SKILL_NAME_LENGTH = 64

/** Longest accepted routing description, matching the Host's schema. */
export const MAX_DESCRIPTION_LENGTH = 1_024

/** Longest accepted extra routing guidance, matching the Host's schema. */
export const MAX_WHEN_TO_USE_LENGTH = 1_024

/** Largest accepted instruction body, matching the Host's schema. */
export const MAX_CONTENT_LENGTH = 262_144

/** One skill as stored in the settings section. */
export interface StoredSkill {
  /** Kebab-case identifier. */
  name: string
  /** Routing description. */
  description: string
  /** Optional extra routing guidance. */
  whenToUse?: string
  /** Markdown instruction body. */
  content: string
  /** When true, the model catalog excludes the skill. */
  disableModelInvocation?: boolean
  /** When false, the slash catalog excludes the skill. */
  userInvocable?: boolean
  /** Whether the Host publishes the skill; defaults to true. */
  enabled?: boolean
}

/** The settings section value. */
export interface SkillsManagerSettings {
  /** Managed skills, in document order. */
  skills?: StoredSkill[]
}

/** A skill as the card lists it. */
export interface SkillView {
  /** Kebab-case identifier. */
  readonly name: string
  /** Routing description. */
  readonly description: string
  /** Whether the Host publishes it. */
  readonly enabled: boolean
  /** Whether the model catalog includes it. */
  readonly modelInvocable: boolean
  /** Whether the slash catalog includes it. */
  readonly userInvocable: boolean
  /** Instruction-body length, shown so a large body is visible before opening it. */
  readonly characters: number
  /** Reasons this stored entry is not publishable, as locale keys. */
  readonly problems: readonly SkillsManagerKey[]
}

/** The add/edit form's draft state. */
export interface DraftState {
  /** Skill name. */
  name: string
  /** Routing description. */
  description: string
  /** Optional extra routing guidance. */
  whenToUse: string
  /** Markdown instruction body. */
  content: string
  /** Whether the model catalog should include the skill. */
  modelInvocable: boolean
  /** Whether the slash catalog should include the skill. */
  userInvocable: boolean
}

/** The card's full render state. */
export interface SkillsManagerCardState {
  /** False while the Host does not serve the namespace; the card renders nothing. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Whether a write is crossing the wire. */
  saving: boolean
  /** Latest refusal, as a locale key; null when the last action succeeded. */
  error: SkillsManagerKey | null
  /** Configured skills, in document order. */
  skills: readonly SkillView[]
  /** Current filter text; empty shows every skill. */
  query: string
  /** How many skills match the current filter. */
  matched: number
  /** Zero-based index of the visible page, clamped to `pageCount`. */
  page: number
  /** Number of pages the filtered list spans; always at least 1. */
  pageCount: number
  /** The current page's slice of the filtered skills. */
  visible: readonly SkillView[]
  /** Whether the add/edit dialog is showing. */
  dialogOpen: boolean
  /** Name of the skill being edited; null while adding. */
  editing: string | null
  /** The form's drafts. */
  draft: DraftState
}

/** Editable draft fields. */
export type DraftField = 'name' | 'description' | 'whenToUse' | 'content'

/** The registration-side face the card's slot entry injects. */
export interface SkillsManagerCardFace {
  /** Card snapshot bound by the renderer as useSkillsManagerCard. */
  hooks: {
    skillsManagerCard: SnapshotStore<SkillsManagerCardState>
  }
  /** Replace the filter text; the list jumps back to the first page. */
  setQuery(query: string): void
  /** Show one page of the filtered list; out-of-range values clamp. */
  setPage(page: number): void
  /** Open the add dialog with an empty draft. */
  openAdd(): void
  /** Open the dialog on an existing skill's stored values. */
  openEdit(name: string): void
  /** Close the dialog, discarding the staged draft. */
  closeDialog(): void
  /** Stage draft text for one field. */
  edit(field: DraftField, text: string): void
  /** Set the model-invocation draft flag. */
  setModelInvocable(modelInvocable: boolean): void
  /** Set the user-invocation draft flag. */
  setUserInvocable(userInvocable: boolean): void
  /** Validate and write the staged skill, then close the dialog on success. */
  submit(): void
  /** Remove one configured skill. */
  remove(name: string): void
  /** Enable or disable one configured skill. */
  setEnabled(name: string, enabled: boolean): void
  /** Restore the form to the stored skill, or clear it while adding. */
  resetDraft(): void
}

/** The empty add form. */
function emptyDraft(): DraftState {
  return {
    name: '',
    description: '',
    whenToUse: '',
    content: '',
    modelInvocable: true,
    userInvocable: true,
  }
}

/** Project one stored skill onto the card's view, decoding defaults and diagnostics. */
export function toView(skill: StoredSkill): SkillView {
  const whenToUse = skill.whenToUse ?? ''
  const problems: SkillsManagerKey[] = []
  if (!SKILL_NAME_PATTERN.test(skill.name) || skill.name.length > MAX_SKILL_NAME_LENGTH) problems.push('problemName')
  if (skill.description.trim().length === 0 || skill.description.length > MAX_DESCRIPTION_LENGTH) problems.push('problemDescription')
  if (whenToUse.length > MAX_WHEN_TO_USE_LENGTH) problems.push('problemWhenToUse')
  if (skill.content.trim().length === 0 || skill.content.length > MAX_CONTENT_LENGTH) problems.push('problemContent')
  return {
    name: skill.name,
    description: skill.description,
    enabled: skill.enabled !== false,
    modelInvocable: skill.disableModelInvocation !== true,
    userInvocable: skill.userInvocable !== false,
    characters: skill.content.length,
    problems,
  }
}

/** Whether one skill matches the filter text, which is case-insensitive over the name and description. */
export function matches(skill: SkillView, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return true
  return skill.name.toLowerCase().includes(needle) || skill.description.toLowerCase().includes(needle)
}

/** Recompute the filtered page after any change to the query, list, or page. */
function applyFilter(state: SkillsManagerCardState): void {
  const filtered = state.skills.filter(skill => matches(skill, state.query))
  state.matched = filtered.length
  state.pageCount = Math.max(1, Math.ceil(filtered.length / SKILLS_MANAGER_PAGE_SIZE))
  state.page = Math.min(Math.max(state.page, 0), state.pageCount - 1)
  const start = state.page * SKILLS_MANAGER_PAGE_SIZE
  state.visible = filtered.slice(start, start + SKILLS_MANAGER_PAGE_SIZE)
}

/** Fill a draft from one stored skill. */
function draftOf(skill: StoredSkill): DraftState {
  return {
    name: skill.name,
    description: skill.description,
    whenToUse: skill.whenToUse ?? '',
    content: skill.content,
    modelInvocable: skill.disableModelInvocation !== true,
    userInvocable: skill.userInvocable !== false,
  }
}

/**
 * Validate a draft and project it onto a stored entry.
 * @param draft - the staged form text.
 * @returns the entry to write, or the first refusal as a locale key.
 */
export function draftToSkill(draft: DraftState): { skill: StoredSkill } | { error: SkillsManagerKey } {
  const name = draft.name.trim()
  if (!SKILL_NAME_PATTERN.test(name) || name.length > MAX_SKILL_NAME_LENGTH) return { error: 'errorName' }
  const description = draft.description.trim()
  if (description.length === 0 || description.length > MAX_DESCRIPTION_LENGTH) return { error: 'errorDescription' }
  const whenToUse = draft.whenToUse.trim()
  if (whenToUse.length > MAX_WHEN_TO_USE_LENGTH) return { error: 'errorWhenToUse' }
  const content = draft.content
  if (content.trim().length === 0 || content.length > MAX_CONTENT_LENGTH) return { error: 'errorContent' }
  return {
    skill: {
      name,
      description,
      ...whenToUse.length === 0 ? {} : { whenToUse },
      content,
      ...draft.modelInvocable ? {} : { disableModelInvocation: true },
      ...draft.userInvocable ? {} : { userInvocable: false },
    },
  }
}

/** Bridges the `skills-manager` settings scope onto the card's snapshot. */
export class SkillsManagerCardController {
  private readonly store: SnapshotStore<SkillsManagerCardState>
  private readonly unsubscribe: () => void

  /** @param scope - the bound settings scope for the `skills-manager` namespace. */
  constructor(private readonly scope: SettingsScope<SkillsManagerSettings>) {
    this.store = createSnapshotStore<SkillsManagerCardState>({
      available: false,
      writable: false,
      saving: false,
      error: null,
      skills: [],
      query: '',
      matched: 0,
      page: 0,
      pageCount: 1,
      visible: [],
      dialogOpen: false,
      editing: null,
      draft: emptyDraft(),
    })
    this.unsubscribe = scope.subscribe(() => { this.project() })
    this.project()
  }

  /** Release the scope subscription. */
  dispose(): void {
    this.unsubscribe()
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot store and its gesture actions.
   */
  inject(): SkillsManagerCardFace {
    return {
      hooks: { skillsManagerCard: this.store },
      setQuery: (query) => {
        this.store.update((state) => { state.query = query; state.page = 0; applyFilter(state) })
      },
      setPage: (page) => { this.store.update((state) => { state.page = page; applyFilter(state) }) },
      openAdd: () => {
        this.store.update((state) => {
          state.dialogOpen = true
          state.editing = null
          state.error = null
          state.draft = emptyDraft()
        })
      },
      openEdit: (name) => {
        const skill = this.stored().find(candidate => candidate.name === name)
        this.store.update((state) => {
          state.dialogOpen = true
          state.editing = skill?.name ?? null
          state.error = null
          state.draft = skill === undefined ? emptyDraft() : draftOf(skill)
        })
      },
      closeDialog: () => {
        this.store.update((state) => {
          state.dialogOpen = false
          state.editing = null
          state.error = null
          state.draft = emptyDraft()
        })
      },
      edit: (field, text) => { this.store.update((draft) => { draft.draft[field] = text }) },
      setModelInvocable: (modelInvocable) => {
        this.store.update((state) => { state.draft.modelInvocable = modelInvocable })
      },
      setUserInvocable: (userInvocable) => {
        this.store.update((state) => { state.draft.userInvocable = userInvocable })
      },
      submit: () => { void this.submit() },
      remove: (name) => { void this.write(this.stored().filter(skill => skill.name !== name)) },
      setEnabled: (name, enabled) => {
        void this.write(this.stored().map(skill => skill.name === name ? { ...skill, enabled } : skill))
      },
      resetDraft: () => {
        this.store.update((state) => {
          const skill = state.editing === null ? undefined : this.stored().find(candidate => candidate.name === state.editing)
          state.draft = skill === undefined ? emptyDraft() : draftOf(skill)
          state.error = null
        })
      },
    }
  }

  /** Copy the resolved scope value onto the card state. */
  private project(): void {
    const snapshot = this.scope.getSnapshot()
    this.store.update((state) => {
      state.available = snapshot.status === 'ready'
      state.writable = snapshot.writable
      state.skills = (snapshot.value?.skills ?? []).map(toView)
      applyFilter(state)
    })
  }

  /** The currently stored skills, verbatim, so a write round-trips untouched fields. */
  private stored(): StoredSkill[] {
    return [...(this.scope.getSnapshot().value?.skills ?? [])]
  }

  /** Validate and write the staged skill. */
  private async submit(): Promise<void> {
    if (!this.store.getSnapshot().available) return
    const draft = this.store.getSnapshot().draft
    const parsed = draftToSkill(draft)
    if ('error' in parsed) {
      this.store.update((state) => { state.error = parsed.error })
      return
    }
    // The stored document fills schema defaults, so drop undefined optional
    // fields rather than writing explicit nulls the Host schema would refuse.
    const entry = stripUndefined(parsed.skill)
    const next = this.stored().filter(skill => skill.name !== entry.name)
    next.push(entry)
    if (await this.write(next)) {
      this.store.update((state) => {
        state.draft = emptyDraft()
        state.dialogOpen = false
        state.editing = null
      })
    }
  }

  /**
   * Persist one skill list.
   * @param next - the complete next list for the namespace's `skills` field.
   * @returns whether the Host accepted the write.
   */
  private async write(next: StoredSkill[]): Promise<boolean> {
    if (!this.store.getSnapshot().available) return false
    if (!this.store.getSnapshot().writable) {
      this.store.update((state) => { state.error = 'readOnly' })
      return false
    }
    this.store.update((state) => { state.saving = true; state.error = null })
    try {
      await this.scope.set('skills', next)
      this.store.update((state) => { state.saving = false })
      return true
    } catch {
      this.store.update((state) => { state.saving = false; state.error = 'saveFailed' })
      return false
    }
  }
}

/** Drop optional fields the form left unset. */
function stripUndefined(skill: StoredSkill): StoredSkill {
  const entry: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(skill)) {
    /* v8 ignore next -- draftToSkill only ever assigns defined fields */
    if (value !== undefined) entry[key] = value
  }
  return entry as unknown as StoredSkill
}
