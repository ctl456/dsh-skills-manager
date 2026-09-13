import z from "@deepseek-ai/schemastery";
import { isSkillName } from "@deepseek-ai/dsh-skill";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region lib/types/skills.js
/**
* Declarative skill registry: the persisted value shape, its Schemastery
* schema, cross-field validation, and the projection into a `ctx.skills`
* provider candidate.
*
* One module owns the value shape because every consumer — the settings
* section, the model tools, the browser card, and the provider — must agree on
* it. A managed skill is an ordinary agent skill: it carries the same
* frontmatter fields a `SKILL.md` file would, so the shipped `skill` tool
* loads it exactly like one discovered from disk.
*
* @module @ctl456/dsh-skills-manager/skills
*/
/** Settings namespace owning the managed skill registry. */
const SETTINGS_NS = "skills-manager";
/** Provider name registered on `ctx.skills`; also the value the UI keys on. */
const DEFAULT_PROVIDER_NAME = "skills-manager";
/** Origin bucket recorded on every managed candidate, so the UI can identify its own rows. */
const MANAGED_SKILL_SOURCE = "skills-manager";
/** Longest accepted routing description, matching what a session catalog can usefully render. */
const MAX_DESCRIPTION_LENGTH = 1024;
/** Longest accepted extra routing guidance. */
const MAX_WHEN_TO_USE_LENGTH = 1024;
/** Largest accepted instruction body, in UTF-16 code units. */
const MAX_CONTENT_LENGTH = 262144;
/** Per-skill schema; every field is optional in the document except the name and body. */
const StoredSkillSchema = z.object({
	name: z.string().required().max(64),
	description: z.string().required().max(MAX_DESCRIPTION_LENGTH),
	whenToUse: z.string().max(MAX_WHEN_TO_USE_LENGTH),
	content: z.string().required().max(MAX_CONTENT_LENGTH),
	disableModelInvocation: z.boolean(),
	userInvocable: z.boolean(),
	enabled: z.boolean()
});
/** Schemastery schema for the settings section and its composition base layer. */
const SectionConfig = z.object({ skills: z.array(StoredSkillSchema).default([]) });
/** Schemastery schema for the composition entry. */
const Config = z.object({
	skills: z.array(StoredSkillSchema).default([]),
	providerName: z.string().min(1).default(DEFAULT_PROVIDER_NAME),
	rank: z.number().default(350),
	tools: z.boolean().default(true)
});
/**
* Resolve a skill's invocation policy. Absent flags permit both audiences,
* matching the filesystem provider's frontmatter defaults.
* @param skill - the stored skill to project.
* @returns the resolved model and user invocation controls.
*/
function invocationOf(skill) {
	return {
		modelInvocable: skill.disableModelInvocation !== true,
		userInvocable: skill.userInvocable !== false
	};
}
/**
* Report every reason a stored skill cannot be published. The registry rejects
* a malformed candidate by throwing, which would fail the whole catalog, so the
* provider filters on this list instead of handing it a bad entry.
* @param skill - the stored skill to check.
* @returns human-readable problems, empty when the entry is publishable.
*/
function validateStoredSkill(skill) {
	const problems = [];
	if (!isSkillName(skill.name)) problems.push(`"${skill.name}" is not a kebab-case skill name (lowercase letters, digits, and single hyphens)`);
	else if (skill.name.length > 64) problems.push(`the name is longer than ${String(64)} characters`);
	const description = skill.description.trim();
	if (description.length === 0) problems.push("the description is empty");
	else if (description.length > 1024) problems.push(`the description is longer than ${String(MAX_DESCRIPTION_LENGTH)} characters`);
	if ((skill.whenToUse?.length ?? 0) > 1024) problems.push(`the "when to use" note is longer than ${String(MAX_WHEN_TO_USE_LENGTH)} characters`);
	if (skill.content.trim().length === 0) problems.push("the instructions are empty");
	else if (skill.content.length > 262144) problems.push(`the instructions are longer than ${String(MAX_CONTENT_LENGTH)} characters`);
	return problems;
}
/**
* Project one stored skill onto the registry's candidate shape.
* @param skill - a valid stored skill.
* @param options - the provider name and discovery rank to stamp on the candidate.
* @returns the candidate the registry merges; the locator is the skill name.
*/
function toCandidate(skill, options) {
	const whenToUse = skill.whenToUse?.trim();
	return {
		name: skill.name,
		description: skill.description.trim(),
		...whenToUse === void 0 || whenToUse.length === 0 ? {} : { whenToUse },
		invocation: invocationOf(skill),
		source: MANAGED_SKILL_SOURCE,
		provider: options.providerName,
		rank: options.rank,
		locator: skill.name
	};
}
/**
* Project one stored skill onto a complete definition, body included.
* @param skill - a valid stored skill.
* @param options - the provider name and discovery rank to stamp on the definition.
* @returns the definition `ctx.skills.get()` resolves for this name.
*/
function toDefinition(skill, options) {
	return {
		...toCandidate(skill, options),
		content: skill.content.trim()
	};
}
//#endregion
//#region lib/types/provider.js
/**
* The `SkillProvider` the manager registers on `ctx.skills`.
*
* Registering a provider is what makes a managed skill a first-class skill:
* the registry merges this catalog with every other provider's, the session
* catalog advertises the winners to the model, and the shipped `skill` tool
* loads the body through here. Discovery re-reads the registry on every call,
* so a body edited outside the manager needs no cache invalidation on this
* side; the manager calls `control.invalidate()` after its own writes to drop
* the registry's completed catalogs.
*
* @module @ctl456/dsh-skills-manager/provider
*/
/** Maps the manager's registry onto the skill registry's provider contract. */
var ManagedSkillProvider = class {
	options;
	/** Provider name the registry merges under. */
	name;
	/** @param options - the registry reader, identity, rank, and warning sink. */
	constructor(options) {
		this.options = options;
		this.name = options.providerName;
	}
	/**
	* List every publishable managed skill.
	*
	* Uninterpretable entries are logged and omitted rather than failing the
	* whole discovery: one bad row must not hide every other skill. The card and
	* `skills_manager_list` report the same rows as diagnostics, which is the
	* surface a human actually reads.
	* @param options - lookup options; discovery here needs no cwd and only observes cancellation.
	* @returns one candidate per enabled, valid entry.
	*/
	list(options) {
		return Promise.resolve().then(() => {
			options.signal?.throwIfAborted();
			const candidates = [];
			for (const skill of this.registry().values()) {
				if (skill.enabled === false) continue;
				const problems = validateStoredSkill(skill);
				if (problems.length > 0) {
					this.options.warn(`skills-manager: ignoring "${skill.name}": ${problems.join("; ")}`);
					continue;
				}
				candidates.push(toCandidate(skill, this.options));
			}
			return candidates;
		});
	}
	/**
	* Load one managed skill's body.
	* @param candidate - the candidate this provider returned earlier.
	* @param options - lookup options; only cancellation is observed.
	* @returns the current definition, or undefined when the entry was removed,
	*   disabled, or became invalid since discovery.
	*/
	get(candidate, options) {
		return Promise.resolve().then(() => {
			options.signal?.throwIfAborted();
			const skill = this.registry().get(candidate.name);
			if (skill === void 0 || skill.enabled === false) return void 0;
			if (validateStoredSkill(skill).length > 0) return void 0;
			return toDefinition(skill, this.options);
		});
	}
	/**
	* The registry indexed by name, last entry winning. The manager keeps names
	* unique, but a hand-edited document may repeat one; indexing here means a
	* duplicate cannot produce two candidates the registry would have to rank,
	* and `get` resolves the same entry `list` published.
	* @returns every stored entry keyed by its skill name.
	*/
	registry() {
		const byName = /* @__PURE__ */ new Map();
		for (const skill of this.options.read()) byName.set(skill.name, skill);
		return byName;
	}
};
//#endregion
//#region lib/types/tools.js
/**
* Model-facing management tools. The model can list the managed skill
* registry and add, remove, enable, or disable an entry; every mutation goes
* through the same port the browser card writes, so chat and UI edits cannot
* diverge.
*
* The tools only own the registry. Making a registered skill loadable is the
* provider's job, so an added skill appears in the session catalog and loads
* through the shipped `skill` tool with no extra wiring here.
*
* @module @ctl456/dsh-skills-manager/tools
*/
/** Build the shared pretty-JSON output declaration. */
function jsonOutput() {
	return {
		schema: { type: "json" },
		render: (_args, value) => [{
			type: "text",
			text: JSON.stringify(value, null, 2)
		}]
	};
}
/** Shared parameter description for the skill name. */
const NAME_DESCRIPTION = "Kebab-case skill name: lowercase letters, digits, and single hyphens (for example \"release-notes\"). The model loads the skill by this exact name.";
/** Shared parameter description for the instruction body. */
const CONTENT_DESCRIPTION = "The skill body in Markdown: the instructions the model follows after loading it. Write the procedure, not a summary of it.";
/** Build a registry entry from one add call. */
function skillFromArgs(args) {
	const whenToUse = args.whenToUse?.trim();
	return {
		name: args.name.trim(),
		description: args.description.trim(),
		...whenToUse === void 0 || whenToUse.length === 0 ? {} : { whenToUse },
		content: args.content,
		...args.disableModelInvocation === void 0 ? {} : { disableModelInvocation: args.disableModelInvocation },
		...args.userInvocable === void 0 ? {} : { userInvocable: args.userInvocable },
		...args.enabled === void 0 ? {} : { enabled: args.enabled }
	};
}
/**
* Build the management tools for one registry port.
* @param port - the live registry the tools read and mutate.
* @returns registry-ready tool definitions, in a stable order.
*/
function managerTools(port) {
	return [
		defineTool({
			name: "skills_manager_list",
			description: "List the agent skills managed by this harness with their enabled state, invocation policy, and any configuration problems. Skills discovered from project and user directories are not listed here; only the ones this manager owns. Use it before adding or removing a skill.",
			parameters: {},
			output: jsonOutput(),
			execute() {
				return Promise.resolve({ skills: port.list() });
			}
		}),
		defineTool({
			name: "skills_manager_add",
			description: "Add an agent skill, or replace the entry with the same name. The harness publishes it immediately, so it appears in the available-skills catalog and can be loaded with the `skill` tool by that name. Give a kebab-case name, a one-line description that says when to use it, and the Markdown instructions to follow.",
			parameters: {
				name: {
					type: "string",
					required: true,
					description: NAME_DESCRIPTION
				},
				description: {
					type: "string",
					required: true,
					description: "One line saying what the skill does and when to use it."
				},
				content: {
					type: "string",
					required: true,
					description: CONTENT_DESCRIPTION
				},
				whenToUse: {
					type: "string",
					description: "Optional extra routing guidance beyond the description."
				},
				disableModelInvocation: {
					type: "boolean",
					description: "When true, hide the skill from the model catalog; defaults to false."
				},
				userInvocable: {
					type: "boolean",
					description: "When false, hide the skill from the user slash catalog; defaults to true."
				},
				enabled: {
					type: "boolean",
					description: "Whether to publish the skill now; defaults to true."
				}
			},
			output: jsonOutput(),
			async execute(args) {
				await port.upsert(skillFromArgs(args));
				return { skills: port.list() };
			}
		}),
		defineTool({
			name: "skills_manager_remove",
			description: "Remove a managed agent skill. It stops appearing in the skill catalog immediately and the stored entry is deleted.",
			parameters: { name: {
				type: "string",
				required: true,
				description: NAME_DESCRIPTION
			} },
			output: jsonOutput(),
			async execute(args) {
				await port.remove(args.name);
				return { skills: port.list() };
			}
		}),
		defineTool({
			name: "skills_manager_set_enabled",
			description: "Enable or disable a managed agent skill without deleting it. Disabling withdraws it from the skill catalog while keeping the stored body; enabling publishes it again.",
			parameters: {
				name: {
					type: "string",
					required: true,
					description: NAME_DESCRIPTION
				},
				enabled: {
					type: "boolean",
					required: true,
					description: "True to publish the skill, false to withdraw it."
				}
			},
			output: jsonOutput(),
			async execute(args) {
				await port.setEnabled(args.name, args.enabled);
				return { skills: port.list() };
			}
		})
	];
}
/**
* Project one stored skill onto the status the tools and the card report.
* @param skill - the stored skill to describe.
* @returns its enabled state, invocation policy, size, and any problems.
*/
function statusOf(skill) {
	const invocation = invocationOf(skill);
	const whenToUse = skill.whenToUse?.trim();
	return {
		name: skill.name,
		description: skill.description,
		...whenToUse === void 0 || whenToUse.length === 0 ? {} : { whenToUse },
		enabled: skill.enabled !== false,
		modelInvocable: invocation.modelInvocable,
		userInvocable: invocation.userInvocable,
		characters: skill.content.length,
		problems: validateStoredSkill(skill)
	};
}
//#endregion
//#region lib/types/index.js
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
/** Cordis plugin name used by loader diagnostics. */
const name = "skills-manager";
/** Services required before the plugin activates. */
const inject = ["skills", "tools"];
/**
* Register the manager: install the registry section, publish the provider,
* expose the management tools, and invalidate the catalog on every change.
* @param ctx - the host context the manager is mounted on.
* @param config - the composition entry's registry, used as the settings base layer.
*/
function apply(ctx, config = { skills: [] }) {
	const providerName = config.providerName ?? "skills-manager";
	const configuredRank = config.rank ?? 350;
	const rank = Number.isFinite(configuredRank) ? configuredRank : 350;
	const toolsEnabled = config.tools ?? true;
	let current = [...config.skills];
	let readSource = () => ({ skills: current });
	let settings;
	let invalidate;
	ctx.skills.registerProvider((control) => {
		invalidate = () => {
			control.invalidate();
		};
		return new ManagedSkillProvider({
			providerName,
			rank,
			read: () => current,
			warn: (message) => {
				ctx.logger.warn(message);
			}
		});
	});
	const list = () => readSource().skills.map(statusOf);
	/**
	* Adopt the registry a source resolved and drop the catalog when it moved.
	* Comparing a JSON projection keeps a no-op write from waking every
	* consumer, while any real edit invalidates immediately rather than at the
	* next watch tick.
	*/
	const sync = (section) => {
		const next = [...section.skills];
		const changed = JSON.stringify(next) !== JSON.stringify(current);
		current = next;
		if (changed) invalidate();
	};
	const persist = async (next) => {
		const previous = current;
		current = next;
		if (settings === void 0) {
			invalidate();
			return;
		}
		try {
			await settings.update(SETTINGS_NS, { skills: next });
		} catch (error) {
			current = previous;
			invalidate();
			throw error;
		}
		invalidate();
	};
	const upsert = async (skill) => {
		const problems = validateStoredSkill(skill);
		if (problems.length > 0) throw new Error(`invalid skill "${skill.name}": ${problems.join("; ")}`);
		const next = current.filter((candidate) => candidate.name !== skill.name);
		next.push(skill);
		await persist(next);
	};
	const remove = async (skillName) => {
		const next = current.filter((candidate) => candidate.name !== skillName);
		if (next.length === current.length) return;
		await persist(next);
	};
	const setEnabled = async (skillName, enabled) => {
		const target = current.find((candidate) => candidate.name === skillName);
		if (target === void 0 || target.enabled !== false === enabled) return;
		await persist(current.map((candidate) => candidate.name === skillName ? {
			...candidate,
			enabled
		} : candidate));
	};
	const port = {
		list,
		upsert,
		remove,
		setEnabled
	};
	if (toolsEnabled) for (const tool of managerTools(port)) ctx.tools.register(tool);
	ctx.inject(["settings"], (settingsCtx) => {
		settings = settingsCtx.settings;
		settingsCtx.settings.installSection(ctx, SETTINGS_NS, SectionConfig, { skills: current }, {
			setSource: (source) => {
				readSource = source;
				sync(source());
			},
			onChange: () => {
				sync(readSource());
			}
		});
		ctx.effect(() => () => {
			settings = void 0;
		}, "skills-manager.settings-source");
	});
}
//#endregion
export { Config, SETTINGS_NS, apply, inject, name };
