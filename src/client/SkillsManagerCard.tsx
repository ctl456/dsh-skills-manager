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
import type { DraftField, SkillsManagerCardFace } from './card-controller.ts'
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
