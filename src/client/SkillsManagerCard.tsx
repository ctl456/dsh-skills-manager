/**
 * The Skills settings section: one page listing the managed skills with a
 * filter box, a paged list, and edit/enable/remove controls, plus one
 * add-or-edit dialog.
 *
 * The page acts on click and never stages a save; the Host is the only
 * authority on whether a write landed, and a refusal shows the localized
 * reason in place. Listing state (filter text, page, dialog visibility) lives
 * on the controller so it survives re-renders and a pushed update can clamp
 * the page it leaves behind.
 */

import type { ChangeEvent } from 'react'
import {
  IconChevronLeftOutline14, IconChevronRightOutline14, IconPlusOutline16, IconSearchOutline16, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the settings.section SlotMap declaration plus the ctx.settingsScope merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {
  DraftField, SkillsManagerCardFace, SkillsManagerCardState, StagedArchive,
} from './card-controller.ts'
import css from './SkillsManagerCard.module.css'

/** Props the renderer binds for the Skills settings section. */
export type SkillsManagerCardProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.skills-manager'>
  & InjectFace<SkillsManagerCardFace>

/** Shared shape of one labeled control. */
interface FieldProps {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly value: string
  readonly disabled: boolean
  readonly onChange: (text: string) => void
}

/** One single-line text control. */
function TextField(props: FieldProps) {
  const change = (event: ChangeEvent<HTMLInputElement>): void => { props.onChange(event.target.value) }
  return (
    <label className={css.field} htmlFor={props.id}>
      <span className={css.label}>{props.label}</span>
      <input id={props.id} className={css.input} type="text" value={props.value} disabled={props.disabled} onChange={change} />
      <span className={css.hint}>{props.hint}</span>
    </label>
  )
}

/** One multi-line text control. */
function AreaField(props: FieldProps & { readonly rows: number }) {
  const change = (event: ChangeEvent<HTMLTextAreaElement>): void => { props.onChange(event.target.value) }
  return (
    <label className={css.field} htmlFor={props.id}>
      <span className={css.label}>{props.label}</span>
      <textarea id={props.id} className={css.textarea} rows={props.rows} value={props.value} disabled={props.disabled} onChange={change} />
      <span className={css.hint}>{props.hint}</span>
    </label>
  )
}

/** One checkbox with a label and an explanation. */
function ToggleField(props: {
  readonly id: string
  readonly label: string
  readonly hint: string
  readonly checked: boolean
  readonly disabled: boolean
  readonly onChange: (checked: boolean) => void
}) {
  const change = (event: ChangeEvent<HTMLInputElement>): void => { props.onChange(event.target.checked) }
  return (
    <label className={css.toggle} htmlFor={props.id}>
      <input id={props.id} type="checkbox" checked={props.checked} disabled={props.disabled} onChange={change} />
      <span className={css.toggleText}>
        <span className={css.label}>{props.label}</span>
        <span className={css.hint}>{props.hint}</span>
      </span>
    </label>
  )
}

/** Render a byte count as something a person can compare at a glance. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Read one picked file as base64, so the archive travels in the same JSON
 * request as a repository URL rather than needing a second upload channel.
 * @param file - the file the user picked.
 * @returns the staged archive, or null when the browser could not read it.
 */
async function stageArchive(file: File): Promise<StagedArchive | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return { name: file.name, base64: btoa(binary) }
  } catch {
    return null
  }
}

/**
 * The import dialog: pick a source, preview it, then install what it offers.
 * The renderer injects the action face, so `hooks` is stripped here just as
 * the slot's InjectFace strips it for the section component.
 */
function ImportDialog(props: {
  readonly t: SkillsManagerCardProps['t']
  readonly state: SkillsManagerCardState
  readonly face: Omit<SkillsManagerCardFace, 'hooks'>
  readonly disabled: boolean
}) {
  const { t, state, face, disabled } = props
  const listing = state.importListing
  const ticked = listing?.skills.filter(skill => skill.selected).length ?? 0
  const installable = listing?.skills.filter(skill => skill.problems.length === 0) ?? []

  const choose = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    // Reset the input so picking the same file twice still fires a change.
    event.target.value = ''
    if (file === undefined) return
    face.setImportArchive(await stageArchive(file))
  }

  return (
    <Modal
      open={state.importOpen}
      onClose={() => { face.closeImport() }}
      title={t('importTitle')}
      closeLabel={t('close')}
      contentClassName={css.dialogContent as string}
      footer={(
        <>
          {/* Cancel stays usable while a read is crossing the wire: the host
              bounds its own reads, but a user who has changed their mind must
              never be held inside a dialog that is still waiting. */}
          <button type="button" className={css.button} onClick={() => { face.closeImport() }}>
            {t('cancel')}
          </button>
          {listing === null
            ? (
              <button type="button" className={css.primary} disabled={disabled || state.importBusy} onClick={() => { face.previewImport() }}>
                {state.importBusy ? t('importPreviewing') : t('importPreview')}
              </button>
            )
            : (
              <button
                type="button"
                className={css.primary}
                disabled={disabled || state.importBusy || ticked === 0}
                onClick={() => { face.installImport() }}
              >
                {state.importBusy ? t('importInstalling') : t('importInstall', { count: ticked })}
              </button>
            )}
        </>
      )}
    >
      <span className={css.hint}>{t('importIntro')}</span>

      {state.importArchive === null
        ? (
          <>
            <TextField
              id="skills-manager-import-source"
              label={t('importSource')}
              hint={t('importSourceHint')}
              value={state.importSource}
              disabled={disabled || state.importBusy}
              onChange={(text) => { face.setImportSource(text) }}
            />
            <TextField
              id="skills-manager-import-subdirectory"
              label={t('importSubdirectory')}
              hint={t('importSubdirectoryHint')}
              value={state.importSubdirectory}
              disabled={disabled || state.importBusy}
              onChange={(text) => { face.setImportSubdirectory(text) }}
            />
          </>
        )
        : (
          <div className={css.field}>
            <span className={css.label}>{t('importArchive')}</span>
            <span className={css.fileRow}>
              <span className={css.fileName}>{state.importArchive.name}</span>
              <button
                type="button"
                className={css.button}
                disabled={disabled || state.importBusy}
                onClick={() => { face.setImportArchive(null) }}
              >
                {t('importClearArchive')}
              </button>
            </span>
          </div>
        )}

      <div className={css.field}>
        <span className={css.label}>{t('importArchive')}</span>
        <input
          id="skills-manager-import-archive"
          className={css.srOnly}
          type="file"
          accept=".zip,application/zip"
          disabled={disabled || state.importBusy}
          onChange={(event) => { void choose(event) }}
        />
        <span className={css.fileRow}>
          <label className={css.button} htmlFor="skills-manager-import-archive">{t('importChooseFile')}</label>
          <span className={css.hint}>{t('importArchiveHint')}</span>
        </span>
      </div>

      {state.importError !== null
        ? (
          <>
            <p className={css.error} role="status">{t(state.importError.key)}</p>
            {state.importError.detail.length === 0 ? null : <span className={css.detail}>{state.importError.detail}</span>}
          </>
        )
        : null}

      {state.importResult !== null
        ? (
          <>
            <p className={css.success} role="status">{t('importInstalled', { count: state.importResult.installed })}</p>
            {state.importResult.skipped.length === 0
              ? null
              : <span className={css.detail}>{t('importSkippedNames', { names: state.importResult.skipped.join(', ') })}</span>}
          </>
        )
        : null}

      {listing === null ? null : (
        <>
          {listing.truncated ? <p className={css.error} role="status">{t('importTruncated')}</p> : null}
          <div className={css.selectRow}>
            <span className={css.hint}>
              {listing.repository === undefined ? listing.source : `${listing.repository}@${listing.ref ?? ''}`}
            </span>
            <span className={css.selectActions}>
              <button type="button" className={css.button} onClick={() => { for (const skill of installable) if (!skill.selected) face.toggleImportName(skill.name) }}>
                {t('importSelectAll')}
              </button>
              <button type="button" className={css.button} onClick={() => { for (const skill of installable) if (skill.selected) face.toggleImportName(skill.name) }}>
                {t('importSelectNone')}
              </button>
            </span>
          </div>
          <div className={css.preview}>
            {listing.skills.map(skill => (
              <label key={`${skill.directory}/${skill.name}`} className={css.candidate}>
                <input
                  type="checkbox"
                  checked={skill.selected}
                  disabled={disabled || state.importBusy || skill.problems.length > 0}
                  onChange={() => { face.toggleImportName(skill.name) }}
                />
                <span className={css.candidateText}>
                  <span className={css.candidateName}>{skill.name}</span>
                  {skill.description.length === 0 ? null : <span className={css.candidateMeta}>{skill.description}</span>}
                  <span className={css.candidateMeta}>
                    {t('importFiles', { count: skill.files })}
                    {` · ${formatBytes(skill.bytes)}`}
                    {skill.vendored ? ` · ${t('importVendored')}` : ''}
                    {skill.dropped === 0 ? '' : ` · ${t('importDropped', { count: skill.dropped })}`}
                  </span>
                  {skill.problems.length === 0
                    ? null
                    : (
                      <>
                        <span className={css.problem}>{t('importProblemLabel')}</span>
                        {skill.problems.map(problem => <span key={problem} className={css.detail}>{problem}</span>)}
                      </>
                    )}
                </span>
              </label>
            ))}
          </div>
          {listing.skipped.length === 0
            ? null
            : (
              <span className={css.detail}>
                {t('importSkippedTitle')}
                {listing.skipped.map(entry => entry.directory).join(', ')}
              </span>
            )}
        </>
      )}
    </Modal>
  )
}

/**
 * Render the Skills settings section.
 * @param props - locale copy, the section snapshot, and its actions.
 * @returns the section, or nothing while the Host does not serve the namespace.
 */
export function SkillsManagerCard(props: SkillsManagerCardProps) {
  const { t } = props
  const state = props.useSkillsManagerCard(snapshot => snapshot)
  if (!state.available) return null
  const disabled = !state.writable || state.saving
  const { draft } = state
  const edit = (field: DraftField) => (text: string): void => { props.edit(field, text) }
  // The whole list is empty, or the filter matched nothing: either way the
  // visible page is empty, and which sentence to show is the one difference.
  const emptyText = state.skills.length === 0 ? t('empty') : t('noMatch')
  return (
    <div className={css.page}>
      <div className={css.header}>
        <h2 className={css.title}>{t('title')}</h2>
        <span className={css.description}>{t('description')}</span>
      </div>
      {!state.writable ? <p className={css.notice} role="status">{t('readOnly')}</p> : null}

      <div className={css.toolbar}>
        <span className={css.searchWrap}>
          <IconSearchOutline16 className={css.searchIcon} size={14} />
          <input
            id="skills-manager-search"
            className={css.search}
            type="search"
            value={state.query}
            placeholder={t('searchPlaceholder')}
            aria-label={t('search')}
            onChange={(event) => { props.setQuery(event.target.value) }}
          />
        </span>
        <button type="button" className={css.primary} disabled={disabled} onClick={() => { props.openAdd() }}>
          <IconPlusOutline16 size={14} />
          {t('addSkill')}
        </button>
        <button type="button" className={css.button} disabled={disabled} onClick={() => { props.openImport() }}>
          {t('importSkill')}
        </button>
      </div>

      {state.visible.length === 0
        ? <p className={css.empty}>{emptyText}</p>
        : (
          <ul className={css.list} aria-label={t('list')}>
            {state.visible.map(skill => (
              <li key={skill.name} className={css.item}>
                <span className={css.itemText}>
                  <span className={css.itemName}>{skill.name}</span>
                  <span className={css.itemMeta} title={skill.description}>{skill.description}</span>
                  <span className={css.itemMeta}>
                    {t('characters', { count: skill.characters })}
                    {skill.modelInvocable ? '' : ` · ${t('modelInvocable')}`}
                    {skill.userInvocable ? '' : ` · ${t('userInvocable')}`}
                  </span>
                  {skill.problems.map(problem => (
                    <span key={problem} className={css.problem}>{t(problem)}</span>
                  ))}
                </span>
                <span className={css.itemActions}>
                  <span className={skill.enabled ? css.badgeOn : css.badgeOff}>
                    {skill.enabled ? t('enabled') : t('disabled')}
                  </span>
                  <button type="button" className={css.button} disabled={disabled} onClick={() => { props.openEdit(skill.name) }}>
                    {t('edit')}
                  </button>
                  <button type="button" className={css.button} disabled={disabled} onClick={() => { props.setEnabled(skill.name, !skill.enabled) }}>
                    {skill.enabled ? t('disable') : t('enable')}
                  </button>
                  <button type="button" className={css.danger} disabled={disabled} onClick={() => { props.remove(skill.name) }}>
                    {t('remove')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

      {state.pageCount > 1
        ? (
          <div className={css.pager}>
            <button
              type="button"
              className={css.button}
              aria-label={t('prevPage')}
              disabled={state.page === 0}
              onClick={() => { props.setPage(state.page - 1) }}
            >
              <IconChevronLeftOutline14 size={14} />
            </button>
            <span className={css.pageInfo}>{t('pageInfo', { page: state.page + 1, pages: state.pageCount })}</span>
            <button
              type="button"
              className={css.button}
              aria-label={t('nextPage')}
              disabled={state.page >= state.pageCount - 1}
              onClick={() => { props.setPage(state.page + 1) }}
            >
              <IconChevronRightOutline14 size={14} />
            </button>
          </div>
        )
        : null}

      <ImportDialog t={t} state={state} face={props} disabled={disabled} />

      <Modal
        open={state.dialogOpen}
        onClose={() => { props.closeDialog() }}
        title={state.editing === null ? t('addTitle') : t('editTitle')}
        closeLabel={t('close')}
        contentClassName={css.dialogContent as string}
        footer={(
          <>
            <button type="button" className={css.button} disabled={state.saving} onClick={() => { props.closeDialog() }}>
              {t('cancel')}
            </button>
            <button type="button" className={css.primary} disabled={disabled} onClick={() => { props.submit() }}>
              {t('save')}
            </button>
          </>
        )}
      >
        <TextField
          id="skills-manager-name"
          label={t('name')}
          hint={t('nameHint')}
          value={draft.name}
          disabled={disabled || state.editing !== null}
          onChange={edit('name')}
        />
        <TextField
          id="skills-manager-description"
          label={t('descriptionLabel')}
          hint={t('descriptionHint')}
          value={draft.description}
          disabled={disabled}
          onChange={edit('description')}
        />
        <TextField
          id="skills-manager-when-to-use"
          label={t('whenToUse')}
          hint={t('whenToUseHint')}
          value={draft.whenToUse}
          disabled={disabled}
          onChange={edit('whenToUse')}
        />
        <AreaField
          id="skills-manager-content"
          label={t('content')}
          hint={t('contentHint')}
          rows={8}
          value={draft.content}
          disabled={disabled}
          onChange={edit('content')}
        />
        <ToggleField
          id="skills-manager-model-invocable"
          label={t('modelInvocable')}
          hint={t('modelInvocableHint')}
          checked={draft.modelInvocable}
          disabled={disabled}
          onChange={(checked) => { props.setModelInvocable(checked) }}
        />
        <ToggleField
          id="skills-manager-user-invocable"
          label={t('userInvocable')}
          hint={t('userInvocableHint')}
          checked={draft.userInvocable}
          disabled={disabled}
          onChange={(checked) => { props.setUserInvocable(checked) }}
        />
        <span className={css.hint}>{t('published')}</span>
        {state.error !== null ? <p className={css.error} role="status">{t(state.error)}</p> : null}
        <div className={css.actions}>
          <button type="button" className={css.button} disabled={disabled} onClick={() => { props.resetDraft() }}>
            {t('reset')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
