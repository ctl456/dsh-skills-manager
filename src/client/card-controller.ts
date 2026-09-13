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

/** One skill a source offers, as the import dialog lists it. */
export interface ImportCandidateView {
  /** Kebab-case name the registry will use. */
  readonly name: string
  /** Routing description, or empty when the source's SKILL.md was unreadable. */
  readonly description: string
  /** Directory the skill was read from. */
  readonly directory: string
  /** Files the install would write. */
  readonly files: number
  /** Bytes the install would write. */
  readonly bytes: number
  /** Files a limit skipped, so a partial copy is visible before installing. */
  readonly dropped: number
  /** Whether the copy looks like a vendored snapshot of another skill. */
  readonly vendored: boolean
  /** Why it cannot be installed, as the host reported it; empty when it can. */
  readonly problems: readonly string[]
  /** Whether the user ticked it. */
  readonly selected: boolean
}

/** Everything one source offered, as the dialog shows it. */
export interface ImportListingView {
  /** The URL or archive name that was read. */
  readonly source: string
  /** `owner/repo`, when the source was a repository. */
  readonly repository?: string
  /** The ref that was resolved. */
  readonly ref?: string
  /** Whether the source was truncated, which makes the listing partial. */
  readonly truncated: boolean
  /** The skills to offer. */
  readonly skills: readonly ImportCandidateView[]
  /** Directories that looked like skills but lost a name collision. */
  readonly skipped: readonly { readonly directory: string; readonly reason: string }[]
}

/** The last refusal, in the two pieces the dialog shows. */
export interface ImportErrorView {
  /** What to tell the user, in their language. */
  readonly key: SkillsManagerKey
  /** The host's own detail, shown muted below; empty when it adds nothing. */
  readonly detail: string
}

/** An archive the user picked, already read for upload. */
export interface StagedArchive {
  /** The file's name, recorded as provenance. */
  readonly name: string
  /** The file's bytes, base64-encoded for the JSON request. */
  readonly base64: string
}

/**
 * Path of the host import route. Kept as a literal rather than imported from
 * the host module: the browser bundle must not pull in host-only code, and the
 * path is part of the wire contract the route owns.
 */
const IMPORT_PATH = '/api/skills-manager.import'

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
  /** Whether the import dialog is showing. */
  importOpen: boolean
  /** Whether the dialog is reading a source or installing, so the buttons lock. */
  importBusy: boolean
  /** The repository URL or shorthand the user typed. */
  importSource: string
  /** An optional directory inside the repository to narrow to. */
  importSubdirectory: string
  /** The archive the user picked; null while importing from a repository. */
  importArchive: StagedArchive | null
  /** The preview listing, once one arrived; null before the first read. */
  importListing: ImportListingView | null
  /** The last refusal, or null when the last call succeeded. */
  importError: ImportErrorView | null
  /** What the last install did, so the dialog can confirm it. */
  importResult: { readonly installed: number; readonly skipped: readonly string[] } | null
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
  /** Open the import dialog on a clean slate. */
  openImport(): void
  /** Close the import dialog, discarding the preview and the staged archive. */
  closeImport(): void
  /** Stage the repository URL the user typed. */
  setImportSource(text: string): void
  /** Stage the directory narrowing. */
  setImportSubdirectory(text: string): void
  /** Stage a picked archive, replacing any repository source. */
  setImportArchive(archive: StagedArchive | null): void
  /** Tick or untick one previewed skill. */
  toggleImportName(name: string): void
  /** Read the staged source and show what it offers. */
  previewImport(): void
  /** Install every ticked skill. */
  installImport(): void
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

/** The HTTP carrier the import dialog posts over; injectable so the controller is testable. */
export type ImportFetch = (input: string, init?: RequestInit) => Promise<Response>

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
export function importProblemKey(problem: string): SkillsManagerKey {
  switch (problem) {
    case 'not-found': return 'importNotFound'
    case 'rate-limited': return 'importRateLimited'
    case 'unauthorized': return 'importUnauthorized'
    case 'truncated': return 'importTruncated'
    case 'unreadable': return 'importBadArchive'
    case 'too-large': return 'importTooLarge'
    case 'empty': return 'importEmpty'
    case 'no-skills': return 'importNoSkills'
    case 'unsupported-host': return 'importBadHost'
    case 'not-a-skill-file': return 'importBadSource'
    case 'malformed': return 'importBadSource'
    case 'network': return 'importNetwork'
    default: return 'importFailed'
  }
}

/** Read one string field from an untrusted JSON object. */
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** Read one number field from an untrusted JSON object. */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Read one boolean field from an untrusted JSON object. */
function flag(value: unknown): boolean {
  return value === true
}

/** Project one untrusted candidate onto the dialog's view. */
function toCandidate(raw: unknown, selected: ReadonlySet<string>): ImportCandidateView {
  const entry = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const problems = Array.isArray(entry['problems'])
    ? entry['problems'].filter((item): item is string => typeof item === 'string')
    : []
  const name = text(entry['name'])
  return {
    name,
    description: text(entry['description']),
    directory: text(entry['directory']),
    files: count(entry['files']),
    bytes: count(entry['bytes']),
    dropped: count(entry['dropped']),
    vendored: flag(entry['vendored']),
    problems,
    selected: selected.has(name),
  }
}

/** Project one untrusted listing onto the dialog's view, or null when it is not one. */
function toListing(raw: unknown, selected: ReadonlySet<string>): ImportListingView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const entry = raw as Record<string, unknown>
  const skills = Array.isArray(entry['skills']) ? entry['skills'].map(item => toCandidate(item, selected)) : []
  const skipped = Array.isArray(entry['skipped'])
    ? entry['skipped'].flatMap((item) => {
      if (typeof item !== 'object' || item === null) return []
      const row = item as Record<string, unknown>
      return [{ directory: text(row['directory']), reason: text(row['reason']) }]
    })
    : []
  const repository = text(entry['repository'])
  const ref = text(entry['ref'])
  return {
    source: text(entry['source']),
    ...repository.length === 0 ? {} : { repository },
    ...ref.length === 0 ? {} : { ref },
    truncated: flag(entry['truncated']),
    skills,
    skipped,
  }
}

/** Bridges the `skills-manager` settings scope onto the card's snapshot. */
export class SkillsManagerCardController {
  private readonly store: SnapshotStore<SkillsManagerCardState>
  private readonly unsubscribe: () => void
  /**
   * The import request currently on the wire. Closing the dialog aborts it, and
   * a request that is no longer this one drops its own answer: a host that
   * answers slowly must not resurrect a dialog the user has already dismissed.
   */
  private inflight: AbortController | undefined

  /**
   * @param scope - the bound settings scope for the `skills-manager` namespace.
   * @param fetcher - HTTP carrier for the host import route.
   */
  constructor(
    private readonly scope: SettingsScope<SkillsManagerSettings>,
    private readonly fetcher: ImportFetch = (input, init) => fetch(input, init),
  ) {
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
      importOpen: false,
      importBusy: false,
      importSource: '',
      importSubdirectory: '',
      importArchive: null,
      importListing: null,
      importError: null,
      importResult: null,
    })
    this.unsubscribe = scope.subscribe(() => { this.project() })
    this.project()
  }

  /** Release the scope subscription and any read still on the wire. */
  dispose(): void {
    this.abortImport()
    this.unsubscribe()
  }

  /** Cancel the in-flight import request, if any. */
  private abortImport(): void {
    this.inflight?.abort()
    this.inflight = undefined
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
      openImport: () => {
        this.store.update((state) => {
          state.importOpen = true
          state.importBusy = false
          state.importSource = ''
          state.importSubdirectory = ''
          state.importArchive = null
          state.importListing = null
          state.importError = null
          state.importResult = null
        })
      },
      closeImport: () => {
        // A read that is still crossing the wire would otherwise answer into a
        // dialog that no longer exists.
        this.abortImport()
        this.store.update((state) => {
          state.importOpen = false
          state.importBusy = false
          state.importListing = null
          state.importArchive = null
          state.importError = null
          state.importResult = null
        })
      },
      setImportSource: (text) => {
        this.store.update((state) => {
          state.importSource = text
          // Typing a repository is how a user abandons a staged archive.
          state.importArchive = null
          state.importResult = null
        })
      },
      setImportSubdirectory: (text) => {
        this.store.update((state) => { state.importSubdirectory = text })
      },
      setImportArchive: (archive) => {
        this.store.update((state) => {
          state.importArchive = archive
          state.importListing = null
          state.importError = null
          state.importResult = null
          if (archive !== null) state.importSource = archive.name
        })
      },
      toggleImportName: (name) => {
        this.store.update((state) => {
          if (state.importListing === null) return
          state.importListing = {
            ...state.importListing,
            skills: state.importListing.skills.map(skill =>
              skill.name === name && skill.problems.length === 0 ? { ...skill, selected: !skill.selected } : skill),
          }
        })
      },
      previewImport: () => { void this.read() },
      installImport: () => { void this.import() },
    }
  }

  /** Ask the host what the staged source offers, and show it. */
  private async read(): Promise<void> {
    const state = this.store.getSnapshot()
    if (state.importBusy) return
    const body = this.requestBody()
    if (body === undefined) return
    this.store.update((draft) => {
      draft.importBusy = true
      draft.importError = null
      draft.importListing = null
      draft.importResult = null
    })
    const answer = await this.post({ action: 'preview', ...body })
    if (answer === undefined) return
    this.store.update((draft) => {
      draft.importBusy = false
      if (!answer.ok) {
        draft.importError = answer.error
        return
      }
      // Every installable skill starts ticked: a repository of one skill — the
      // common case — then needs no further gesture, which is what makes this
      // usable for someone who does not know what a multi-skill collection is.
      draft.importListing = {
        ...answer.listing,
        skills: answer.listing.skills.map(skill => ({ ...skill, selected: skill.problems.length === 0 })),
      }
    })
  }

  /** Install every ticked skill from the staged source. */
  private async import(): Promise<void> {
    const state = this.store.getSnapshot()
    if (state.importBusy || state.importListing === null) return
    const names = state.importListing.skills.filter(skill => skill.selected).map(skill => skill.name)
    if (names.length === 0) return
    const body = this.requestBody()
    if (body === undefined) return
    this.store.update((draft) => {
      draft.importBusy = true
      draft.importError = null
      draft.importResult = null
    })
    const answer = await this.post({ action: 'install', skills: names, ...body })
    if (answer === undefined) return
    this.store.update((draft) => {
      draft.importBusy = false
      if (!answer.ok) {
        draft.importError = answer.error
        return
      }
      draft.importResult = answer.result
      // The registry itself arrives through the settings scope the Host
      // writes, so the list below the dialog refreshes on its own.
      draft.importListing = null
    })
  }

  /** The staged source as request fields, or undefined when the user staged nothing usable. */
  private requestBody(): Record<string, unknown> | undefined {
    const state = this.store.getSnapshot()
    if (state.importArchive !== null) {
      return { archive: { name: state.importArchive.name, base64: state.importArchive.base64 } }
    }
    const source = state.importSource.trim()
    if (source.length === 0) {
      this.store.update((draft) => { draft.importError = { key: 'importNeedSource', detail: '' } })
      return undefined
    }
    const subdirectory = state.importSubdirectory.trim()
    return { source, ...subdirectory.length === 0 ? {} : { subdirectory } }
  }

  /**
   * Post one import request and decode the answer, turning any failure into a
   * view.
   * @param body - the request the dialog staged.
   * @returns the decoded answer, or undefined when the request was superseded
   * (the dialog closed, or a newer request replaced it) and has nothing to say.
   */
  private async post(body: Record<string, unknown>): Promise<
    | { readonly ok: true; readonly listing: ImportListingView } & { readonly result: { installed: number; skipped: readonly string[] } }
    | { readonly ok: false; readonly error: ImportErrorView }
    | undefined
  > {
    this.abortImport()
    const controller = new AbortController()
    this.inflight = controller
    /** Whether this request is still the one the dialog is waiting on. */
    const current = (): boolean => this.inflight === controller
    let response: Response
    try {
      response = await this.fetcher(IMPORT_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      return current() ? { ok: false, error: { key: 'importNetwork', detail: '' } } : undefined
    }
    if (!current()) return undefined
    let parsed: unknown
    try {
      parsed = await response.json()
    } catch {
      return current() ? { ok: false, error: { key: 'importNetwork', detail: '' } } : undefined
    }
    if (!current()) return undefined
    this.inflight = undefined
    const payload = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
    if (payload['ok'] !== true) {
      const problem = text(payload['problem'], 'internal')
      return { ok: false, error: { key: importProblemKey(problem), detail: text(payload['message']) } }
    }
    const selected = new Set(
      this.store.getSnapshot().importListing?.skills.filter(skill => skill.selected).map(skill => skill.name) ?? [],
    )
    const listing = toListing(payload['listing'], selected)
    const installed = Array.isArray(payload['installed']) ? payload['installed'] : []
    const skipped = Array.isArray(payload['skipped'])
      ? payload['skipped'].flatMap((item) => {
        if (typeof item !== 'object' || item === null) return []
        const name = text((item as Record<string, unknown>)['name'])
        return name.length === 0 ? [] : [name]
      })
      : []
    return {
      ok: true,
      listing: listing ?? {
        source: text(payload['source']),
        truncated: false,
        skills: [],
        skipped: [],
      },
      result: { installed: installed.length, skipped },
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
