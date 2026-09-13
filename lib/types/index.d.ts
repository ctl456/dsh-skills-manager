/**
 * Skills manager plugin: one place to add, remove, enable, and disable agent
 * skills, and the provider registration that makes the harness able to load
 * them.
 *
 * The plugin keeps a declarative registry of skills. The registry is stored in
 * the `skills-manager` user-settings section when a settings provider is
 * composed (the Web profile mounts one), so the browser card and the model
 * tools edit the same document.
 *
 * Making a skill loadable is deliberately not this plugin's job: the manager
 * registers one ordinary `ctx.skills` provider, so the shipped session catalog
 * advertises managed skills beside the filesystem ones and the shipped `skill`
 * tool loads their bodies. A skill added from chat or from the page is
 * therefore a first-class skill, not a private list entry.
 *
 * Named exports (no default export) so the Loader reads `name`, `inject`, and
 * `Config` for injection and validation.
 *
 * @module @ctl456/dsh-skills-manager
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config, SETTINGS_NS } from './skills.ts';
/** Cordis plugin name used by loader diagnostics. */
export declare const name = "skills-manager";
/** Services required before the plugin activates. */
export declare const inject: string[];
/** Schemastery schema for the composition entry. */
export { Config, SETTINGS_NS };
/** Registry value shape re-exported for tools, tests, and downstream consumers. */
export type { SkillsSection, StoredSkill } from './skills.ts';
/** Status shape re-exported for the card and downstream consumers. */
export type { SkillStatus } from './tools.ts';
/**
 * Register the manager: install the registry section, publish the provider,
 * expose the management tools, and invalidate the catalog on every change.
 * @param ctx - the host context the manager is mounted on.
 * @param config - the composition entry's registry, used as the settings base layer.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map