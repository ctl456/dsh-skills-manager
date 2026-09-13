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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { SKILLS_MANAGER_NS } from './card-controller.ts';
/** Settings namespace the card edits, re-exported for consumers keying slot entries. */
export { SKILLS_MANAGER_NS };
/** Required client services: the slot registry, locale, remote, and settings transport. */
export declare const inject: string[];
/**
 * Register the skills manager's browser surface.
 * @param ctx - the client plugin context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map