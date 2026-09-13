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
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SkillsManagerCardFace } from './card-controller.ts';
/** Props the renderer binds for the Skills settings section. */
export type SkillsManagerCardProps = PropsRuntime<'settings.section'> & PropsLocale<'settings.skills-manager'> & InjectFace<SkillsManagerCardFace>;
/**
 * Render the Skills settings section.
 * @param props - locale copy, the section snapshot, and its actions.
 * @returns the section, or nothing while the Host does not serve the namespace.
 */
export declare function SkillsManagerCard(props: SkillsManagerCardProps): import("react").JSX.Element | null;
//# sourceMappingURL=SkillsManagerCard.d.ts.map