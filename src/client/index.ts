/**
 * Browser half of the skills manager: register the page's dictionary and
 * contribute the Skills page as its own `settings.section` entry.
 *
 * The section sits below Agent presets (order 26, right after the MCP servers
 * page at 25), so managing skills is a first-class settings page rather than a
 * tab inside Plugins; a deployment that never composes the manager shows no
 * page.
 *
 * @module @ctl456/dsh-skills-manager/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { SkillsManagerCard } from './SkillsManagerCard.tsx'
import { SKILLS_MANAGER_NS, SkillsManagerCardController, type SkillsManagerSettings } from './card-controller.ts'
import { en, zh } from './locales.ts'

/** Settings namespace the card edits, re-exported for consumers keying slot entries. */
export { SKILLS_MANAGER_NS }

/** Locale namespace owning this card's copy. */
const NS = 'settings.skills-manager'

/** Required client services: the slot registry, locale, remote, and settings transport. */
export const inject = ['slots', 'locale', 'remote', 'settingsScope']

/**
 * Register the skills manager's browser surface.
 * @param ctx - the client plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-skills-manager: dictionaries')

  const scope = ctx.settingsScope.bind<SkillsManagerSettings>({ namespace: SKILLS_MANAGER_NS })
  const controller = new SkillsManagerCardController(scope)
  ctx.effect(() => () => { controller.dispose() }, 'ui-skills-manager: card controller')

  // Ordered after the MCP servers page (25), which is itself below Agent
  // presets (20): the skill roster is an integration surface, not a
  // preference, so it belongs at the end of the nav until something newer
  // claims a higher seat.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: SKILLS_MANAGER_NS,
    order: 26,
    label: () => ctx.locale.bind(NS)('title'),
    locale: NS,
    inject: () => controller.inject(),
  }, SkillsManagerCard))
}
