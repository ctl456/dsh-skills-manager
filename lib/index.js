import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { dshHomePath } from "@deepseek-ai/dsh-home-paths";
import z from "@deepseek-ai/schemastery";
import { isSkillName } from "@deepseek-ai/dsh-skill";
import { unzipSync } from "fflate";
import { parse } from "yaml";
import { Buffer } from "node:buffer";
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
/**
* Directory under the Harness home that holds the files of imported skills.
*
* Imported skills keep their body in the settings document, but the
* `references/`, `scripts/` and `assets/` their instructions name have to exist
* on disk for the model to resolve them, so they land here — beside the
* settings that describe them, and outside the user skill root the shipped
* filesystem provider scans, so one skill is never published twice.
*/
const MANAGED_FILES_DIR = "skills-manager";
/** Longest accepted provenance string; long enough for a URL with a query. */
const MAX_ORIGIN_LENGTH = 2048;
/** Longest accepted routing description, matching what a session catalog can usefully render. */
const MAX_DESCRIPTION_LENGTH = 1024;
/** Longest accepted extra routing guidance. */
const MAX_WHEN_TO_USE_LENGTH = 1024;
/** Largest accepted instruction body, in UTF-16 code units. */
const MAX_CONTENT_LENGTH = 262144;
/** Schema for one skill's provenance. */
const SkillOriginSchema = z.object({
	kind: z.union(["github", "archive"]).required(),
	source: z.string().required().max(MAX_ORIGIN_LENGTH),
	repository: z.string().max(MAX_ORIGIN_LENGTH),
	ref: z.string().max(MAX_ORIGIN_LENGTH),
	directory: z.string().max(MAX_ORIGIN_LENGTH),
	installedAt: z.string().required().max(64)
});
/** Schema for the files an import wrote. */
const InstalledFilesSchema = z.object({
	directory: z.string().required().max(64),
	files: z.number().required(),
	bytes: z.number().required(),
	dropped: z.number().required()
});
/** Per-skill schema; every field is optional in the document except the name and body. */
const StoredSkillSchema = z.object({
	name: z.string().required().max(64),
	description: z.string().required().max(MAX_DESCRIPTION_LENGTH),
	whenToUse: z.string().max(MAX_WHEN_TO_USE_LENGTH),
	content: z.string().required().max(MAX_CONTENT_LENGTH),
	disableModelInvocation: z.boolean(),
	userInvocable: z.boolean(),
	enabled: z.boolean(),
	origin: SkillOriginSchema.default(void 0),
	installed: InstalledFilesSchema.default(void 0)
});
/** Schemastery schema for the settings section and its composition base layer. */
const SectionConfig = z.object({ skills: z.array(StoredSkillSchema).default([]) });
/** Schemastery schema for the composition entry. */
const Config = z.object({
	skills: z.array(StoredSkillSchema).default([]),
	providerName: z.string().min(1).default(DEFAULT_PROVIDER_NAME),
	rank: z.number().default(350),
	tools: z.boolean().default(true),
	githubToken: z.string()
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
*
* An imported skill also carries a resource base, which is how the shipped
* `skill` tool tells the model where to resolve the relative paths the body
* mentions — without it, a skill whose instructions say "run
* `scripts/detect-patterns.js`" is unusable. A hand-written skill has no files
* behind it, so it gets no base and the model is told the provider manages its
* resources.
* @param skill - a valid stored skill.
* @param options - the provider name and discovery rank to stamp on the definition.
* @param resourceBase - where this skill's files live, when it has any.
* @returns the definition `ctx.skills.get()` resolves for this name.
*/
function toDefinition(skill, options, resourceBase) {
	return {
		...toCandidate(skill, options),
		content: skill.content.trim(),
		...resourceBase === void 0 ? {} : { resourceBase }
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
			return toDefinition(skill, this.options, this.options.resourceBaseOf?.(skill));
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
//#region lib/types/install.js
/**
* Write an imported skill's files beside its body.
*
* A managed skill keeps its instructions in the settings document, but the
* `references/`, `scripts/` and `assets/` those instructions name have to exist
* on disk for the model to resolve them, so an import materialises them under
* one directory per skill. Everything here treats the repository as untrusted:
* target paths are re-derived from the skill's own directory, any path that
* escapes it is refused rather than sanitised, and a re-install clears the old
* directory so a file the upstream repository deleted cannot linger and shadow
* a stale instruction.
*
* The filesystem is injected so the whole module is testable without touching
* a real disk.
*
* @module @ctl456/dsh-skills-manager/install
*/
/**
* Resolve the absolute directory one skill's files live in.
* @param root - the absolute root holding every imported skill.
* @param name - the skill name, which is also the directory name.
* @returns the absolute directory, or undefined when the name is unusable.
*/
function skillDirectory(root, name) {
	if (name.length === 0 || name === "." || name === "..") return void 0;
	if (isAbsolute(name) || name.includes("/") || name.includes("\\")) return void 0;
	const directory = resolve(root, name);
	if (directory !== join(resolve(root), name)) return void 0;
	if (!directory.startsWith(resolve(root) + sep)) return void 0;
	return directory;
}
/**
* Derive the files to write for one discovered skill.
*
* Each target is the file's path below the skill's own directory, so a skill at
* `skills/x` writes `SKILL.md` and `scripts/a.js` rather than reproducing
* `skills/x/scripts/a.js`. That keeps a repository's layout out of the managed
* root and keeps a relocated skill's internal relative paths correct.
* @param skill - the discovered skill, whose directory is repository-relative.
* @returns the staged files, or the first reason the plan is unsafe.
*/
function planInstall(skill) {
	const files = [];
	for (const blob of skill.files) {
		const target = targetOf$1(blob, skill.directory);
		if (target === void 0) return {
			ok: false,
			problem: "unsafe-path"
		};
		files.push({
			source: blob.path,
			target,
			size: blob.size
		});
	}
	return {
		ok: true,
		files
	};
}
/** Strip the skill directory prefix and refuse anything that escapes it. */
function targetOf$1(blob, directory) {
	const path = blob.path;
	if (isAbsolute(path)) return void 0;
	const target = directory.length === 0 ? path : relative(directory, path);
	if (target.length === 0 || target === ".") return void 0;
	if (isAbsolute(target)) return void 0;
	const segments = target.split(/[\\/]/);
	if (segments.some((segment) => segment === ".." || segment === "" || segment === ".")) return void 0;
	return segments.join("/");
}
/**
* Write one skill's files, replacing whatever the previous install left.
* @param options - the managed root, the skill, its staged files, how to read a source file, and the filesystem.
* @returns what was written, for the settings document.
* @throws Error when the skill name or a staged path is unsafe.
*/
async function installSkillFiles(options) {
	const directory = skillDirectory(options.root, options.name);
	if (directory === void 0) throw new Error(`unsafe skill directory for "${options.name}"`);
	await options.fs.rm(directory, {
		recursive: true,
		force: true
	});
	await options.fs.mkdir(directory, { recursive: true });
	let bytes = 0;
	let files = 0;
	for (const file of options.files) {
		const target = resolve(directory, file.target);
		if (!target.startsWith(directory + sep)) throw new Error(`unsafe install path "${file.target}"`);
		const parent = resolve(target, "..");
		if (parent !== directory) await options.fs.mkdir(parent, { recursive: true });
		const data = await options.read(file.source);
		await options.fs.writeFile(target, data);
		bytes += data.byteLength;
		files += 1;
	}
	return {
		directory: options.name,
		files,
		bytes,
		dropped: 0
	};
}
/**
* Delete one skill's files.
*
* A skill's settings entry and its files are removed separately, so this is
* deliberately forgiving: a directory that is already gone is the common case
* for a hand-written skill and must not fail the removal.
* @param options - the managed root, the skill name, and the filesystem.
* @returns whether a directory was removed.
*/
async function removeSkillFiles(options) {
	const directory = skillDirectory(options.root, options.name);
	if (directory === void 0) return false;
	await options.fs.rm(directory, {
		recursive: true,
		force: true
	});
	return true;
}
//#endregion
//#region lib/types/discovery.js
/**
* Turn a repository's file list into the skills it contains.
*
* Repositories do not agree on where a skill lives, and the shipped filesystem
* provider only understands `<name>/SKILL.md` and `<name>.md`. The survey that
* drove this module found, among sixteen popular skill repositories, all of:
*
*   - the whole repository is one skill (`SKILL.md` at the root, with the
*     `references/`, `scripts/` and `templates/` it names beside it);
*   - a container directory holds many (`skills/<name>/SKILL.md`);
*   - each top-level directory is one (`<name>/SKILL.md`);
*   - an agent-specific nest holds them (`plugins/<p>/skills/<name>/SKILL.md`,
*     `.claude/skills/<name>/SKILL.md`);
*   - a repository vendors copies of other skill repositories under a
*     materials directory, so the same skill name appears more than once.
*
* Discovery is therefore a pure function of the blob list: find every
* `SKILL.md`, decide which directory owns it, hand it the files below that
* directory that no nested skill owns, and finally drop duplicate skill names
* in favour of the copy closest to the repository root — the canonical one,
* not a vendored or translated snapshot.
*
* This module never touches the network, so the layout rules are testable
* against recorded trees.
*
* @module @ctl456/dsh-skills-manager/discovery
*/
/** Default caps: generous for real skills, far below a monorepo's weight. */
const DEFAULT_LIMITS = {
	maxFileBytes: 2 * 1024 * 1024,
	maxSkillBytes: 24 * 1024 * 1024,
	maxFiles: 400
};
/**
* Path segments that never carry skill instructions or resources, so an import
* skips them instead of spending its budget on them.
*/
const NOISE_SEGMENTS = new Set([
	".git",
	".github",
	"node_modules",
	"__pycache__",
	".venv",
	"venv",
	".mypy_cache",
	".pytest_cache",
	".ruff_cache",
	".tox",
	".idea",
	".vscode"
]);
/** Files that are repository furniture rather than skill content. */
const NOISE_FILES = new Set([
	".DS_Store",
	"Thumbs.db",
	".editorconfig",
	".gitattributes",
	".gitignore",
	"CONTRIBUTING.md",
	"CODE_OF_CONDUCT.md",
	"SECURITY.md",
	"GIT_COMMIT_CHECKLIST.md"
]);
/**
* Path segments that mark a directory as somebody else's vendored snapshot, so
* a duplicate skill name prefers the copy outside them.
*/
const VENDOR_MARKERS = new Set([
	"vendor",
	"vendors",
	"third_party",
	"third-party",
	"external",
	"archived",
	"资料",
	"参考资料",
	"项目资料"
]);
/** A trailing `-main` / `-master` directory is an unpacked archive of another repository. */
const VENDOR_SUFFIX = /-(?:main|master)$/;
/**
* Whether a path is furniture the importer should ignore.
* @param path - repository-relative path.
* @returns true when no skill content lives at that path.
*/
function isNoisePath(path) {
	const segments = path.split("/");
	const base = segments.at(-1) ?? "";
	if (NOISE_FILES.has(base)) return true;
	return segments.some((segment) => NOISE_SEGMENTS.has(segment));
}
/**
* Enumerate the skills in a repository tree.
* @param blobs - every blob the tree API returned.
* @param options - the user's scoped subpath and the payload caps.
* @returns the skills to offer, ordered by directory.
*/
function discoverSkills(blobs, options = {}) {
	const limits = options.limits ?? DEFAULT_LIMITS;
	const scope = normalizeSubpath(options.subpath);
	const scoped = [];
	for (const blob of blobs) {
		if (!inScope(blob.path, scope) || isNoisePath(blob.path)) continue;
		scoped.push(blob);
	}
	const skillFiles = scoped.filter((blob) => isSkillFile(blob.path)).map((blob) => blob.path);
	const directories = [...new Set(skillFiles.map((path) => dirname(path)))].sort(compareDirectories);
	const owned = directories.map((directory) => new Set(directories.filter((other) => other !== directory)));
	return directories.map((directory, index) => {
		return collect(directory, scoped.filter((blob) => belongsTo(blob, directory, owned[index])), limits);
	});
}
/**
* Keep one skill per name, preferring the copy closest to the repository root.
*
* A duplicate is normally a vendored snapshot or a translation of the same
* skill; the canonical copy is the shallowest one, and a copy under a
* materials or vendor directory loses to one that is not, however deep it sits.
* @param skills - discovered skills with their resolved names.
* @returns the survivors, in their original order.
*/
function dedupeByName(skills) {
	const best = /* @__PURE__ */ new Map();
	for (const skill of skills) {
		const current = best.get(skill.name);
		if (current === void 0 || prefers(skill, current)) best.set(skill.name, skill);
	}
	const kept = [];
	const dropped = [];
	for (const skill of skills) if (best.get(skill.name) === skill) kept.push(skill);
	else dropped.push(skill);
	return {
		kept,
		dropped
	};
}
/** Whether the candidate beats the incumbent as the canonical copy. */
function prefers(candidate, incumbent) {
	const candidateVendored = isVendored(candidate.directory);
	if (candidateVendored !== isVendored(incumbent.directory)) return !candidateVendored;
	const candidateDepth = depth(candidate.directory);
	const incumbentDepth = depth(incumbent.directory);
	if (candidateDepth !== incumbentDepth) return candidateDepth < incumbentDepth;
	return candidate.directory < incumbent.directory;
}
/** Whether any segment of a directory marks it as a vendored snapshot. */
function isVendored(directory) {
	return directory.split("/").some((segment) => VENDOR_MARKERS.has(segment) || VENDOR_SUFFIX.test(segment));
}
/** Number of path segments, ignoring the empty root. */
function depth(directory) {
	return directory.length === 0 ? 0 : directory.split("/").length;
}
/** Assemble one skill from the files it owns, applying the caps. */
function collect(directory, files, limits) {
	const sorted = [...files].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	const keptFiles = [];
	let bytes = 0;
	let dropped = 0;
	for (const file of sorted) {
		if (file.size > limits.maxFileBytes || keptFiles.length >= limits.maxFiles || bytes + file.size > limits.maxSkillBytes) {
			dropped += 1;
			continue;
		}
		keptFiles.push(file);
		bytes += file.size;
	}
	return {
		directory,
		skillFile: directory.length === 0 ? "SKILL.md" : `${directory}/SKILL.md`,
		slug: slugOf(directory),
		layout: layoutOf(directory),
		files: keptFiles,
		bytes,
		dropped,
		vendored: isVendored(directory)
	};
}
/**
* Classify a skill directory into the layout taxonomy.
*
* The test is path-shaped, not content-shaped: a `skills/<name>` parent is the
* documented container convention whether the skill keeps one file or fifty,
* and anything deeper is a host-specific nest that we still import but label
* so the card can explain why a repository surfaced an unexpected name.
* @param directory - the skill directory, repository-relative.
* @returns which bucket the directory fell into.
*/
function layoutOf(directory) {
	if (directory.length === 0) return "repository";
	const segments = directory.split("/");
	if (segments.length === 1) return "collection";
	if (segments.at(-2) === "skills") return "container";
	return "nested";
}
/** Whether a file sits under a skill directory and no nested skill directory. */
function belongsTo(blob, directory, otherSkills) {
	if (!under(blob.path, directory)) return false;
	for (const other of otherSkills) if (other.length > directory.length && under(blob.path, other)) return false;
	return true;
}
/** Whether a path equals a directory or sits below it. */
function under(path, directory) {
	if (directory.length === 0) return true;
	return path === directory || path.startsWith(`${directory}/`);
}
/** The directory part of a repository-relative path. */
function dirname(path) {
	const index = path.lastIndexOf("/");
	return index < 0 ? "" : path.slice(0, index);
}
/** Whether a path names a skill instruction file. */
function isSkillFile(path) {
	return (path.split("/").at(-1) ?? "").toLowerCase() === "skill.md";
}
/** The provisional skill name: the directory's own name, or the repository root. */
function slugOf(directory) {
	if (directory.length === 0) return "";
	return directory.split("/").at(-1) ?? "";
}
/** Order skill directories so a root skill comes first, then shallow ones. */
function compareDirectories(left, right) {
	const depthDelta = depth(left) - depth(right);
	if (depthDelta !== 0) return depthDelta;
	return left < right ? -1 : left > right ? 1 : 0;
}
/** Normalize a user-scoped subpath for prefix comparison. */
function normalizeSubpath(subpath) {
	if (subpath === void 0) return "";
	return subpath.replace(/^\/+|\/+$/g, "");
}
/** Whether a path falls inside the user's scoped subpath. */
function inScope(path, scope) {
	if (scope.length === 0) return true;
	return path === scope || path.startsWith(`${scope}/`);
}
//#endregion
//#region lib/types/archive.js
/**
* Read a downloaded skill archive.
*
* A `.zip` is the second way a skill reaches the manager: people package a
* skill directory, or an agent host exports one, and there is no repository to
* walk. Unpacking happens in memory and produces the same `RepoBlob` shape the
* GitHub tree reader produces, so one discovery pass serves both sources and a
* skill behaves identically however it arrived.
*
* An archive is untrusted input, so the reader refuses rather than repairs:
* directories, macOS resource forks and the usual editor noise are dropped
* before decompression, entry count and total size are capped so a zip bomb
* cannot exhaust the host, and a single wrapping folder — what GitHub's own
* "Download ZIP" adds — is stripped so a packaged repository keeps the layout
* its author wrote.
*
* @module @ctl456/dsh-skills-manager/archive
*/
/** Default ceilings: generous for real skills, small next to a zip bomb. */
const DEFAULT_ARCHIVE_LIMITS = {
	maxEntries: 5e3,
	maxTotalBytes: 128 * 1024 * 1024
};
/**
* Unpack a zip archive into the repository-shaped entries discovery consumes.
* @param bytes - the archive's bytes, as downloaded or read from disk.
* @param limits - the ceilings to enforce; defaults to {@link DEFAULT_ARCHIVE_LIMITS}.
* @returns the usable entries and the stripped root, or why the archive was refused.
*/
function readArchive(bytes, limits = DEFAULT_ARCHIVE_LIMITS) {
	let unzipped;
	try {
		unzipped = unzipSync(bytes, { filter: (file) => !file.name.endsWith("/") && !isArchiveNoise(file.name) });
	} catch {
		return {
			ok: false,
			problem: "unreadable"
		};
	}
	const paths = Object.keys(unzipped);
	if (paths.length === 0) return {
		ok: false,
		problem: "empty"
	};
	const root = wrappingRoot(paths);
	const entries = [];
	let dropped = 0;
	let total = 0;
	for (const path of paths) {
		const data = unzipped[path];
		if (entries.length >= limits.maxEntries) {
			dropped += 1;
			continue;
		}
		total += data.byteLength;
		if (total > limits.maxTotalBytes) return {
			ok: false,
			problem: "too-large"
		};
		const relative = root.length === 0 ? path : path.slice(root.length + 1);
		if (relative.length === 0) continue;
		entries.push({
			path: relative,
			size: data.byteLength,
			data
		});
	}
	if (entries.length === 0) return {
		ok: false,
		problem: "empty"
	};
	entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	return {
		ok: true,
		entries,
		root,
		dropped
	};
}
/**
* Project archive entries onto the blob shape a tree walk produces.
* @param entries - the entries {@link readArchive} returned.
* @returns one blob per entry, carrying its uncompressed size.
*/
function archiveBlobs(entries) {
	return entries.map((entry) => ({
		path: entry.path,
		size: entry.size
	}));
}
/** Paths an archive carries that are never skill content. */
function isArchiveNoise(path) {
	const normalized = path.replace(/\\/g, "/");
	if (normalized.startsWith("__MACOSX/")) return true;
	if (normalized.split("/").some((segment) => segment.startsWith("._"))) return true;
	return isNoisePath(normalized);
}
/**
* The single folder an archive wraps its content in, if it has one.
*
* A GitHub "Download ZIP" puts everything under `<repo>-<ref>/`, so without
* this the layout would be read as a container of exactly one oddly named
* directory. Stripping only when every entry shares one first segment keeps an
* archive that deliberately starts with `skills/` from being flattened.
* @param paths - every kept path in the archive.
* @returns the prefix to strip, without a trailing slash; empty when there is none.
*/
function wrappingRoot(paths) {
	const first = paths[0];
	const slash = first.indexOf("/");
	if (slash <= 0) return "";
	const candidate = first.slice(0, slash);
	for (const path of paths) if (!path.startsWith(`${candidate}/`)) return "";
	return candidate;
}
//#endregion
//#region lib/types/frontmatter.js
/**
* Read a `SKILL.md` document the way the shipped filesystem provider reads one.
*
* An imported skill must be indistinguishable from a discovered one, so the
* frontmatter rules here mirror `skill-filesystem` exactly: a leading `---`
* block parsed as YAML, `name` and `description` required, `whenToUse` as the
* optional extra routing hint, and the kebab-case invocation flags
* `disable-model-invocation` / `user-invocable` with the same permissive
* boolean forms. The legacy camelCase spellings are rejected rather than
* silently ignored, so a repository using them reports a readable problem
* instead of importing a skill that behaves differently than its author meant.
*
* @module @ctl456/dsh-skills-manager/frontmatter
*/
/**
* Parse one `SKILL.md` body into the registry's shape.
* @param raw - the file's full text, frontmatter included.
* @returns the skill, or the first reason it could not be read.
*/
function parseSkillDocument(raw) {
	const parsed = splitFrontmatter(raw);
	if (parsed === void 0) return {
		ok: false,
		problem: "missing-frontmatter"
	};
	const { data, body } = parsed;
	const name = stringField(data, "name");
	if (name === void 0 || !isSkillName(name)) return {
		ok: false,
		problem: "invalid-name"
	};
	const description = stringField(data, "description");
	if (description === void 0) return {
		ok: false,
		problem: "missing-description"
	};
	let invocation;
	try {
		invocation = parseInvocationPolicy(data);
	} catch {
		return {
			ok: false,
			problem: "invalid-invocation"
		};
	}
	const whenToUse = stringField(data, "whenToUse");
	return {
		ok: true,
		document: {
			name,
			description: description.trim(),
			...whenToUse === void 0 ? {} : { whenToUse },
			invocation,
			content: body.trim(),
			data
		}
	};
}
/**
* Split a Markdown document into its YAML frontmatter and the body below it.
* @param raw - the file's full text.
* @returns the mapping and body, or undefined when the document has no frontmatter block.
*/
function splitFrontmatter(raw) {
	const firstLineEnd = raw.indexOf("\n");
	if (firstLineEnd < 0) return void 0;
	if (raw.slice(0, firstLineEnd).replace(/\r$/, "") !== "---") return void 0;
	const closing = findClosing(raw, firstLineEnd + 1);
	if (closing === void 0) return void 0;
	let parsed;
	try {
		parsed = parse(raw.slice(firstLineEnd + 1, closing.start));
	} catch {
		return;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return void 0;
	return {
		data: parsed,
		body: raw.slice(closing.bodyStart)
	};
}
/** Find the closing `---` line and where the body starts after it. */
function findClosing(raw, start) {
	let lineStart = start;
	while (lineStart <= raw.length) {
		const nextNewline = raw.indexOf("\n", lineStart);
		const lineEnd = nextNewline < 0 ? raw.length : nextNewline;
		if (raw.slice(lineStart, lineEnd).replace(/\r$/, "") === "---") return {
			start: lineStart,
			bodyStart: nextNewline < 0 ? raw.length : nextNewline + 1
		};
		if (nextNewline < 0) return void 0;
		lineStart = nextNewline + 1;
	}
}
/** Read a non-empty string field. */
function stringField(data, key) {
	const value = data[key];
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/** Resolve the invocation flags, rejecting the legacy camelCase spellings. */
function parseInvocationPolicy(data) {
	rejectLegacyKey(data, "disableModelInvocation", "disable-model-invocation");
	rejectLegacyKey(data, "modelInvocable", "disable-model-invocation");
	rejectLegacyKey(data, "userInvocable", "user-invocable");
	return {
		modelInvocable: frontmatterBoolean(data, "disable-model-invocation") !== true,
		userInvocable: frontmatterBoolean(data, "user-invocable") !== false
	};
}
/** Fail on a legacy invocation key so the author sees the canonical spelling. */
function rejectLegacyKey(data, legacy, canonical) {
	if (Object.hasOwn(data, legacy)) throw new Error(`frontmatter field "${legacy}" is unsupported; use "${canonical}"`);
}
/** Read a permissive boolean flag, matching the filesystem provider's forms. */
function frontmatterBoolean(data, key) {
	if (!Object.hasOwn(data, key)) return void 0;
	const value = data[key];
	if (typeof value === "boolean") return value;
	if (value === 1 || value === "1") return true;
	if (value === 0 || value === "0") return false;
	if (typeof value === "string") switch (value.toLowerCase()) {
		case "true":
		case "yes":
		case "on": return true;
		case "false":
		case "no":
		case "off": return false;
	}
	throw new TypeError(`frontmatter field "${key}" must be a boolean`);
}
//#endregion
//#region lib/types/location.js
/**
* Parse what a user typed into a location the installer can read.
*
* People paste every shape GitHub offers — the repository page, a `/tree/`
* branch, a `/tree/<branch>/<dir>` subdirectory, a `/blob/` file, a
* `raw.githubusercontent.com` link, an `owner/repo` shorthand, or an scp-style
* clone URL — and the referenced repositories disagree about where a skill
* lives. This module answers only "which repository, which ref, which path";
* finding the skills is {@link ./discovery.ts}.
*
* @module @ctl456/dsh-skills-manager/location
*/
/** Hosts whose web URLs this module understands. */
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const RAW_HOSTS = new Set(["raw.githubusercontent.com", "raw.github.com"]);
/**
* Parse a user-supplied repository location.
*
* Accepts `https://github.com/<owner>/<repo>`, a `/tree/<ref>[/<dir>]` or
* `/blob/<ref>/<file>` URL, a `raw.githubusercontent.com` file URL, an
* `owner/repo` shorthand, and `git@github.com:<owner>/<repo>.git`.
* @param input - the raw text the user typed or pasted.
* @returns the repository pointer, or why the text could not be read.
*/
function parseLocation(input) {
	const text = input.trim().replace(/^<|>$/g, "");
	if (text.length === 0) return {
		ok: false,
		problem: "empty"
	};
	const scp = /^git@([^:]+):(.+)$/.exec(text);
	if (scp !== null) return fromPathParts(scp[2], scp[1].toLowerCase(), text);
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : void 0;
	if (withScheme !== void 0) {
		let parsed;
		try {
			parsed = new URL(withScheme);
		} catch {
			return {
				ok: false,
				problem: "malformed"
			};
		}
		const host = parsed.hostname.toLowerCase();
		if (RAW_HOSTS.has(host)) return fromRawPath(parsed.pathname, withScheme);
		if (!GITHUB_HOSTS.has(host)) return {
			ok: false,
			problem: "unsupported-host"
		};
		return fromGitHubPath(parsed.pathname, withScheme);
	}
	return fromPathParts(text, "github.com", text);
}
/**
* Split a repository-relative path into the candidate ref/path pairs to try.
*
* `/tree/<a>/<b>/<c>` is ambiguous — the branch could be `a`, `a/b`, or the
* whole thing could be a path on the default branch — and GitHub itself guesses
* the same way. The resolver walks these longest-ref-first so a real branch
* whose name contains a slash still wins over a directory of the same name.
* @param ref - the ref segment the URL named, or undefined for the default branch.
* @param rest - the path segments below the ref, already split on `/`.
* @returns the splits to try, in the order the resolver should attempt them.
*/
function refSplits(ref, rest) {
	if (ref === void 0) return [{
		ref: "",
		path: rest.join("/")
	}];
	const splits = [];
	for (let take = rest.length; take >= 0; take -= 1) splits.push({
		ref: [ref, ...rest.slice(0, take)].join("/"),
		path: rest.slice(take).join("/")
	});
	return splits;
}
/** Build a location from the path of a github.com URL. */
function fromGitHubPath(pathname, url) {
	const segments = decodeSegments(pathname);
	if (segments.length < 2) return {
		ok: false,
		problem: "malformed"
	};
	const owner = segments[0];
	const repo = stripGitSuffix(segments[1]);
	if (owner.length === 0 || repo.length === 0) return {
		ok: false,
		problem: "malformed"
	};
	const marker = segments[2];
	if (marker !== "tree" && marker !== "blob") return {
		ok: true,
		location: {
			kind: "github",
			owner,
			repo,
			url: `https://github.com/${owner}/${repo}`
		}
	};
	const ref = segments[3];
	if (ref === void 0) return {
		ok: true,
		location: {
			kind: "github",
			owner,
			repo,
			url: `https://github.com/${owner}/${repo}`
		}
	};
	const rest = segments.slice(4);
	if (marker === "blob") {
		if (!isSkillFileName(rest.join("/"))) return {
			ok: false,
			problem: "not-a-skill-file"
		};
		return {
			ok: true,
			location: {
				kind: "github",
				owner,
				repo,
				ref,
				...rest.length > 1 ? { subpath: rest.slice(0, -1).join("/") } : {},
				file: rest.at(-1),
				url
			}
		};
	}
	return {
		ok: true,
		location: {
			kind: "github",
			owner,
			repo,
			ref,
			...rest.length > 0 ? { subpath: rest.join("/") } : {},
			url
		}
	};
}
/** Build a location from a raw.githubusercontent.com path. */
function fromRawPath(pathname, url) {
	const segments = decodeSegments(pathname);
	if (segments.length < 4) return {
		ok: false,
		problem: "malformed"
	};
	const [owner, rawRepo, ref, ...rest] = segments;
	const repo = stripGitSuffix(rawRepo);
	if (!isSkillFileName(rest.join("/"))) return {
		ok: false,
		problem: "not-a-skill-file"
	};
	return {
		ok: true,
		location: {
			kind: "github",
			owner,
			repo,
			ref,
			...rest.length > 1 ? { subpath: rest.slice(0, -1).join("/") } : {},
			file: rest.at(-1),
			url
		}
	};
}
/** Build a location from bare `owner/repo[/...]` path segments. */
function fromPathParts(text, _host, url) {
	const segments = decodeSegments(text.replace(/^\/+/, ""));
	if (segments.length < 2) return {
		ok: false,
		problem: "malformed"
	};
	const owner = segments[0];
	const repo = stripGitSuffix(segments[1]);
	if (owner.length === 0 || repo.length === 0) return {
		ok: false,
		problem: "malformed"
	};
	const rest = segments.slice(2);
	const marker = rest[0];
	if (marker === "tree" || marker === "blob") {
		const ref = rest[1];
		const below = rest.slice(2);
		if (marker === "blob") {
			if (!isSkillFileName(below.join("/"))) return {
				ok: false,
				problem: "not-a-skill-file"
			};
			return {
				ok: true,
				location: {
					kind: "github",
					owner,
					repo,
					...ref === void 0 ? {} : { ref },
					...below.length > 1 ? { subpath: below.slice(0, -1).join("/") } : {},
					...below.length > 0 ? { file: below.at(-1) } : {},
					url
				}
			};
		}
		return {
			ok: true,
			location: {
				kind: "github",
				owner,
				repo,
				...ref === void 0 ? {} : { ref },
				...below.length > 0 ? { subpath: below.join("/") } : {},
				url
			}
		};
	}
	return {
		ok: true,
		location: {
			kind: "github",
			owner,
			repo,
			...rest.length > 0 ? { subpath: rest.join("/") } : {},
			url
		}
	};
}
/** Decode each path segment, leaving a malformed escape literal. */
function decodeSegments(path) {
	return path.split("/").filter((segment) => segment.length > 0).map((segment) => {
		try {
			return decodeURIComponent(segment);
		} catch {
			return segment;
		}
	});
}
/** Strip a trailing `.git`, which clone URLs carry and web URLs do not. */
function stripGitSuffix(repo) {
	return repo.endsWith(".git") ? repo.slice(0, -4) : repo;
}
/** Whether a path names a skill instruction file. */
function isSkillFileName(path) {
	return (path.split("/").at(-1) ?? "").toLowerCase() === "skill.md";
}
//#endregion
//#region lib/types/github.js
/**
* Read a skill repository over the GitHub REST API.
*
* Two endpoints do all the work, chosen so an import costs as few rate-limited
* requests as possible: one `git/trees/<ref>?recursive=1` call lists the whole
* repository, and everything afterwards is fetched from
* `raw.githubusercontent.com`, which serves file content without counting
* against the API quota. That split is what makes a 197-skill repository like
* `manyuegong33/r0crawl_skills` practical to import one skill out of.
*
* The `fetch` used here is injected rather than global, so the resolver is
* testable against recorded responses and a deployment can supply its own
* transport.
*
* @module @ctl456/dsh-skills-manager/github
*/
/** Base of the REST API that lists trees and repositories. */
const API_BASE = "https://api.github.com";
/** Base of the raw content host, which is not rate-limited like the API. */
const RAW_BASE = "https://raw.githubusercontent.com";
/**
* Ceiling on one GitHub read. A socket that stalls without closing leaves the
* request pending forever, and there is nothing above this layer that would end
* it: an import that hangs holds the card's dialog open with no way back, so the
* read has to fail on its own. Every request here is a small JSON document or a
* text file, so a read this slow is already a failure.
*/
const REQUEST_TIMEOUT_MS = 3e4;
/** A failed GitHub read, carrying a problem code rather than a parsed message. */
var GitHubError = class extends Error {
	/** Stable problem code callers branch on. */
	problem;
	/** HTTP status when the failure came from a response. */
	status;
	/**
	* @param problem - the classified failure.
	* @param message - a human-readable detail for the log.
	* @param status - the HTTP status, when there was one.
	*/
	constructor(problem, message, status) {
		super(message);
		this.name = "GitHubError";
		this.problem = problem;
		this.status = status;
	}
};
/**
* Resolve a location to a tree.
*
* A `/tree/<a>/<b>` URL is ambiguous about where the ref ends, so each
* candidate split is tried in turn and the first that resolves wins — the same
* guess GitHub's own web UI makes. A location without an explicit ref reads the
* repository's default branch.
* @param location - the parsed repository pointer.
* @param client - the transport and optional credentials.
* @returns the ref and every blob at it.
* @throws GitHubError when the repository, the ref, or the network fails.
*/
async function resolveTree(location, client) {
	if (location.ref === void 0) return await readTree(location, await readDefaultBranch(location, client), client);
	const rest = splitPath(location.subpath);
	const splits = refSplits(location.ref, rest);
	let failure;
	for (const split of splits) try {
		return {
			...await readTreeAt(location, split.ref, client),
			ref: split.ref
		};
	} catch (error) {
		if (!(error instanceof GitHubError)) throw error;
		if (error.problem !== "not-found") throw error;
		failure = error;
	}
	/* v8 ignore next -- refSplits always yields at least one split, so a loop that
	never returned always assigned `failure` from a not-found error. */
	throw failure ?? new GitHubError("not-found", `no ref matched in ${location.url}`);
}
/**
* Read a text file at a ref.
* @param location - the repository pointer, for owner and repo.
* @param ref - the resolved ref.
* @param path - repository-relative path.
* @param client - the transport and optional credentials.
* @returns the file's text.
* @throws GitHubError when the file is missing or the read fails.
*/
async function readTextFile(location, ref, path, client) {
	return await (await send(rawUrl(location, ref, path), client, "text")).text();
}
/**
* Read a binary file at a ref.
* @param location - the repository pointer, for owner and repo.
* @param ref - the resolved ref.
* @param path - repository-relative path.
* @param client - the transport and optional credentials.
* @returns the file's bytes.
* @throws GitHubError when the file is missing or the read fails.
*/
async function readBinaryFile(location, ref, path, client) {
	const response = await send(rawUrl(location, ref, path), client, "binary");
	return new Uint8Array(await response.arrayBuffer());
}
/** Read the repository's default branch name. */
async function readDefaultBranch(location, client) {
	const body = await (await send(`${API_BASE}/repos/${location.owner}/${location.repo}`, client, "json")).json();
	if (typeof body.default_branch !== "string" || body.default_branch.length === 0) throw new GitHubError("not-found", `${location.owner}/${location.repo} reports no default branch`);
	return body.default_branch;
}
/** Read the tree of the default branch. */
async function readTree(location, ref, client) {
	return {
		...await readTreeAt(location, ref, client),
		ref
	};
}
/** Read the tree at one candidate ref, mapping a miss to `not-found`. */
async function readTreeAt(location, ref, client) {
	const body = await (await send(`${API_BASE}/repos/${location.owner}/${location.repo}/git/trees/${encodePath(ref)}?recursive=1`, client, "json")).json();
	if (!Array.isArray(body.tree)) throw new GitHubError("not-found", `${location.owner}/${location.repo}@${ref} returned no tree`);
	const blobs = [];
	for (const entry of body.tree) {
		if (entry.type !== "blob") continue;
		if (typeof entry.path !== "string") continue;
		blobs.push({
			path: entry.path,
			size: typeof entry.size === "number" ? entry.size : 0
		});
	}
	return {
		blobs,
		truncated: body.truncated === true
	};
}
/** Issue one request and classify a non-success response. */
async function send(url, client, accept) {
	const headers = {
		accept: accept === "json" ? "application/vnd.github+json" : accept === "text" ? "text/plain" : "application/octet-stream",
		"user-agent": "dsh-skills-manager",
		"x-github-api-version": "2022-11-28"
	};
	if (client.token !== void 0 && client.token.length > 0) headers.authorization = `Bearer ${client.token}`;
	let response;
	const signal = client.signal === void 0 ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : AbortSignal.any([client.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
	try {
		response = await client.fetch(url, {
			headers,
			signal
		});
	} catch (error) {
		throw new GitHubError("network", `request to ${url} failed: ${String(error)}`);
	}
	if (response.ok) return response;
	throw classify(response, url);
}
/** Map an HTTP failure onto the problem taxonomy. */
function classify(response, url) {
	const detail = `${response.status} ${response.statusText} for ${url}`;
	if (response.status === 404) return new GitHubError("not-found", detail, 404);
	if (response.status === 401) return new GitHubError("unauthorized", detail, 401);
	if (response.status === 403 || response.status === 429) return response.headers.get("x-ratelimit-remaining") === "0" ? new GitHubError("rate-limited", detail, response.status) : new GitHubError("unauthorized", detail, response.status);
	if (response.status === 422) return new GitHubError("truncated", detail, 422);
	return new GitHubError("network", detail, response.status);
}
/** Build a raw content URL for one repository-relative path. */
function rawUrl(location, ref, path) {
	return `${RAW_BASE}/${location.owner}/${location.repo}/${encodePath(ref)}/${encodePath(path)}`;
}
/** Percent-encode each path segment, leaving the separators intact. */
function encodePath(path) {
	return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}
/** Split a subpath into segments for the ref-splitting search. */
function splitPath(subpath) {
	if (subpath === void 0 || subpath.length === 0) return [];
	return subpath.split("/");
}
//#endregion
//#region lib/types/source.js
/**
* Turn "somewhere a skill lives" into registry entries.
*
* Three things have to agree for an import to work: what the user pointed at
* (a repository URL or a downloaded archive), which directories in it are
* skills (that is {@link ./discovery.ts}), and what each one calls itself (that
* is the `SKILL.md` frontmatter, which the repository layout cannot be trusted
* to reflect). This module joins them and is the only place that knows both a
* GitHub tree and a zip end up in the same shape.
*
* Listing and installing are separate calls on purpose. Listing is what the
* card shows before anything is written — the real name, the description, how
* many files and bytes would land on disk — and installing re-reads the source
* rather than trusting a listing that a caller could have edited.
*
* @module @ctl456/dsh-skills-manager/source
*/
/** A failed import, carrying a code the card can turn into advice. */
var ImportError = class extends Error {
	/** Stable problem code callers branch on. */
	problem;
	/**
	* @param problem - the classified failure.
	* @param message - a human-readable detail for the log and the card.
	*/
	constructor(problem, message) {
		super(message);
		this.name = "ImportError";
		this.problem = problem;
	}
};
/**
* List the skills a source offers without writing anything.
* @param source - the repository URL or archive to read.
* @param limits - discovery ceilings; defaults to {@link DEFAULT_LIMITS}.
* @returns the listing, ready for the card or the model to show.
* @throws ImportError when the source cannot be read at all.
*/
async function listSkills(source, limits = DEFAULT_LIMITS) {
	const opened = await openSource(source, limits);
	return project(opened, await prepare(opened, limits));
}
/**
* Install the named skills from a source onto disk.
*
* The source is read again rather than trusting a previous listing, so a
* repository that changed between the preview and the confirmation installs
* what is actually there. Every chosen skill is written before any entry is
* returned; a caller that fails halfway still sees the entries for the skills
* that did land, because the files and the settings document are updated
* separately.
* @param options - the source, the managed root, the chosen names, and the filesystem.
* @returns the registry entries to persist, plus the names that produced nothing.
* @throws ImportError when the source itself cannot be read.
*/
async function installSkills(options) {
	const limits = options.limits ?? DEFAULT_LIMITS;
	const opened = await openSource(options.source, limits);
	const prepared = await prepare(opened, limits);
	const byName = /* @__PURE__ */ new Map();
	for (const item of prepared.prepared) if (item.problems.length === 0) byName.set(item.name, item);
	const at = (options.now ?? (() => /* @__PURE__ */ new Date()))().toISOString();
	const installed = [];
	const skipped = [];
	for (const name of options.names) {
		const item = byName.get(name);
		if (item === void 0) {
			const known = prepared.prepared.find((candidate) => candidate.name === name);
			skipped.push({
				name,
				reason: known === void 0 ? "the source no longer offers this skill" : known.problems.join("; ")
			});
			continue;
		}
		installed.push(await writeOne(item, opened, options.root, options.fs, at));
	}
	if (installed.length === 0 && skipped.length === 0) throw new ImportError("no-skills", `${opened.source} offers no skill to install`);
	return {
		installed,
		skipped
	};
}
/** Write one prepared skill and project it onto a registry entry. */
async function writeOne(item, opened, root, fs, installedAt) {
	const plan = planInstall(item.discovered);
	if (!plan.ok) throw new ImportError(plan.problem, `refusing to install "${item.name}": ${plan.problem}`);
	const installed = {
		...await installSkillFiles({
			root,
			name: item.name,
			files: plan.files,
			read: (source) => opened.bytes(source),
			fs
		}),
		dropped: item.discovered.dropped
	};
	const origin = {
		kind: opened.kind,
		source: opened.source,
		...opened.repository === void 0 ? {} : { repository: opened.repository },
		...opened.ref === void 0 ? {} : { ref: opened.ref },
		directory: item.directory,
		installedAt
	};
	const document = item.document;
	const whenToUse = document.whenToUse?.trim();
	const skill = {
		name: item.name,
		description: document.description,
		...whenToUse === void 0 || whenToUse.length === 0 ? {} : { whenToUse },
		content: document.content,
		...document.invocation.modelInvocable ? {} : { disableModelInvocation: true },
		...document.invocation.userInvocable ? {} : { userInvocable: false },
		origin,
		installed
	};
	const problems = validateStoredSkill(skill);
	if (problems.length > 0) throw new ImportError("no-skills", `refusing to install "${item.name}": ${problems.join("; ")}`);
	return skill;
}
/** Read every candidate's `SKILL.md` and resolve its real name. */
async function prepare(opened, limits) {
	const discovered = discoverSkills(opened.blobs, {
		...opened.subpath.length === 0 ? {} : { subpath: opened.subpath },
		limits
	});
	const prepared = [];
	for (const skill of discovered) {
		const parsed = parseSkillDocument(await opened.text(skill.skillFile));
		if (parsed.ok) {
			prepared.push({
				name: parsed.document.name,
				directory: skill.directory,
				discovered: skill,
				document: parsed.document,
				problems: []
			});
			continue;
		}
		prepared.push({
			name: skill.slug,
			directory: skill.directory,
			discovered: skill,
			problems: [`${skill.skillFile}: ${parsed.problem}`]
		});
	}
	const { kept, dropped } = dedupeByName(prepared);
	return {
		prepared: kept,
		skipped: dropped.map((item) => ({
			directory: item.directory,
			reason: `duplicate name "${item.name}"`
		}))
	};
}
/** Project the prepared skills onto the serialisable listing shape. */
function project(opened, source) {
	const skills = source.prepared.map((item) => {
		const document = item.document;
		const whenToUse = document?.whenToUse?.trim();
		return {
			name: item.name,
			description: document?.description ?? "",
			...whenToUse === void 0 || whenToUse.length === 0 ? {} : { whenToUse },
			directory: item.directory,
			layout: item.discovered.layout,
			files: item.discovered.files.length,
			bytes: item.discovered.bytes,
			dropped: item.discovered.dropped,
			vendored: item.discovered.vendored,
			modelInvocable: document?.invocation.modelInvocable ?? true,
			userInvocable: document?.invocation.userInvocable ?? true,
			problems: item.problems
		};
	});
	return {
		kind: opened.kind,
		source: opened.source,
		...opened.repository === void 0 ? {} : { repository: opened.repository },
		...opened.ref === void 0 ? {} : { ref: opened.ref },
		directory: opened.subpath,
		truncated: opened.truncated,
		skills,
		skipped: source.skipped
	};
}
/** Resolve a source into blobs plus a way to read them. */
async function openSource(source, limits) {
	if (source.kind === "archive") return openArchive(source, limits);
	const parsed = parseLocation(source.input);
	if (!parsed.ok) throw new ImportError(parsed.problem, `cannot read "${source.input}": ${parsed.problem}`);
	const location = parsed.location;
	let tree;
	try {
		tree = await resolveTree(location, source.client);
	} catch (error) {
		if (error instanceof GitHubError) throw new ImportError(error.problem, error.message);
		throw error;
	}
	const where = `${location.owner}/${location.repo}`;
	return {
		kind: "github",
		source: location.url,
		repository: where,
		ref: tree.ref,
		subpath: scoped(location.subpath, source.subdirectory),
		truncated: tree.truncated,
		blobs: tree.blobs,
		text: (path) => readTextFile(location, tree.ref, path, source.client),
		bytes: (path) => readBinaryFile(location, tree.ref, path, source.client),
		dropped: 0
	};
}
/** Join the URL's own scope with an explicit subdirectory, in that order. */
function scoped(subpath, subdirectory) {
	const parts = [];
	if (subpath !== void 0 && subpath.length > 0) parts.push(subpath);
	if (subdirectory !== void 0 && subdirectory.length > 0) parts.push(subdirectory.replace(/^\/+|\/+$/g, ""));
	return parts.filter((part) => part.length > 0).join("/");
}
/** Open an in-memory archive as a source. */
function openArchive(source, limits) {
	const archive = readArchive(source.bytes, archiveLimits(limits));
	if (!archive.ok) throw new ImportError(archive.problem, `cannot read "${source.name}": ${archive.problem}`);
	const byPath = new Map(archive.entries.map((entry) => [entry.path, entry.data]));
	return {
		kind: "archive",
		source: source.name,
		subpath: "",
		truncated: false,
		blobs: archiveBlobs(archive.entries),
		text: (path) => Promise.resolve(decode(byPath, path)),
		bytes: (path) => Promise.resolve(need(byPath, path)),
		dropped: archive.dropped
	};
}
/** Scale the archive ceilings from the discovery ceilings the caller set. */
function archiveLimits(limits) {
	return {
		maxEntries: limits.maxFiles * 20,
		maxTotalBytes: limits.maxSkillBytes * 20
	};
}
/** Decode one archive entry as UTF-8, refusing a path the archive does not hold. */
function decode(byPath, path) {
	return new TextDecoder().decode(need(byPath, path));
}
/** Look up one archive entry, refusing a path the archive does not hold. */
function need(byPath, path) {
	const data = byPath.get(path);
	if (data === void 0) throw new ImportError("unreadable", `"${path}" is not in the archive`);
	return data;
}
//#endregion
//#region lib/types/route.js
/**
* The card's import endpoint: one authenticated `POST` route that previews a
* source and installs from it.
*
* The card cannot do this work itself. Reading a repository and writing a
* skill's files need the host's network and filesystem, and the settings scope
* the card already holds can only edit the registry document. Connection
* routes exist for exactly this case — the same channel the session log export
* uses — so the card sends a small JSON request and the host answers with the
* preview or the install result.
*
* The route is a pure function of an importer and a `Request`, so every branch
* is testable without a web server, and the transport's own trust and
* authentication fence applies before this code runs.
*
* @module @ctl456/dsh-skills-manager/route
*/
/** Absolute path of the card's import route, below the shared `/api` channel. */
const SKILLS_IMPORT_PATH = "/api/skills-manager.import";
/** Largest archive the card may send, in bytes, before base64 expansion. */
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
/**
* Handle one import request.
* @param importer - the host importer the route drives.
* @param request - the decoded request; its body must be JSON.
* @returns a JSON response, always with a `ok` discriminator.
*/
async function importRoute(importer, request) {
	if (request.method !== "POST") return failure(405, "method", "this route accepts POST only");
	let body;
	try {
		body = await request.json();
	} catch {
		return failure(400, "malformed", "the request body is not JSON");
	}
	if (typeof body !== "object" || body === null) return failure(400, "malformed", "the request body is not an object");
	const action = body.action;
	if (action !== "preview" && action !== "install") return failure(400, "malformed", "action must be \"preview\" or \"install\"");
	const parsed = targetOf(body);
	if (!parsed.ok) return failure(400, parsed.problem, parsed.message);
	const names = namesOf(body.skills);
	if (!names.ok) return failure(400, "malformed", names.message);
	if (action === "install" && names.names.length === 0) return failure(400, "malformed", "installing needs at least one skill name; omit \"skills\" to preview");
	try {
		if (action === "preview") return json(200, {
			ok: true,
			action: "preview",
			listing: await importer.preview(parsed.target)
		});
		const outcome = await importer.install(parsed.target, names.names);
		return json(200, {
			ok: true,
			action: "install",
			installed: outcome.installed,
			skipped: outcome.skipped
		});
	} catch (error) {
		if (error instanceof ImportError) return failure(statusFor(error.problem), error.problem, error.message);
		return failure(500, "internal", "the import failed unexpectedly; see the host log");
	}
}
/** Map an importer problem onto an HTTP status the card can act on. */
function statusFor(problem) {
	if (problem === "rate-limited" || problem === "unauthorized" || problem === "network") return 502;
	if (problem === "truncated") return 502;
	return 400;
}
/** Read the target a request describes, or the reason it does not describe one. */
function targetOf(body) {
	if (body.archive !== void 0 && body.source !== void 0) return {
		ok: false,
		problem: "malformed",
		message: "send either \"source\" or \"archive\", not both"
	};
	if (body.archive !== void 0) {
		const archive = body.archive;
		if (typeof archive !== "object" || archive === null) return {
			ok: false,
			problem: "malformed",
			message: "\"archive\" must be an object"
		};
		const { name, base64 } = archive;
		if (typeof name !== "string" || name.length === 0 || name.length > 256) return {
			ok: false,
			problem: "malformed",
			message: "\"archive.name\" must be a non-empty file name"
		};
		if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) return {
			ok: false,
			problem: "malformed",
			message: "\"archive.base64\" must be base64 text"
		};
		if (base64.length > Math.ceil(8388608 / 3) * 4) return {
			ok: false,
			problem: "too-large",
			message: `the archive is larger than the ${String(MAX_ARCHIVE_BYTES)} byte upload limit`
		};
		const bytes = Buffer.from(base64, "base64");
		if (bytes.byteLength === 0) return {
			ok: false,
			problem: "malformed",
			message: "the archive is empty"
		};
		return {
			ok: true,
			target: {
				kind: "archive",
				name,
				bytes
			}
		};
	}
	if (typeof body.source !== "string" || body.source.trim().length === 0) return {
		ok: false,
		problem: "malformed",
		message: "\"source\" must be a non-empty repository URL"
	};
	if (body.subdirectory !== void 0 && typeof body.subdirectory !== "string") return {
		ok: false,
		problem: "malformed",
		message: "\"subdirectory\" must be a string"
	};
	const subdirectory = typeof body.subdirectory === "string" ? body.subdirectory.trim() : "";
	return {
		ok: true,
		target: {
			kind: "github",
			source: body.source.trim(),
			...subdirectory.length === 0 ? {} : { subdirectory }
		}
	};
}
/** Read the requested names, refusing a list that is not a list of strings. */
function namesOf(value) {
	if (value === void 0) return {
		ok: true,
		names: []
	};
	if (!Array.isArray(value)) return {
		ok: false,
		message: "\"skills\" must be an array of names"
	};
	const names = [];
	for (const entry of value) {
		if (typeof entry !== "string" || entry.trim().length === 0) return {
			ok: false,
			message: "\"skills\" must contain only non-empty names"
		};
		names.push(entry.trim());
	}
	return {
		ok: true,
		names
	};
}
/** One JSON response. */
function json(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" }
	});
}
/** One refusal, in the same shape as a success so the card parses once. */
function failure(status, problem, message) {
	return json(status, {
		ok: false,
		problem,
		message
	});
}
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
* @param importer - the source importer; omit it to leave the import tool unregistered.
* @returns registry-ready tool definitions, in a stable order.
*/
function managerTools(port, importer) {
	const tools = [
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
	if (importer !== void 0) tools.push(importSkills(port, importer));
	return tools;
}
/** Shared parameter description for the import source. */
const SOURCE_DESCRIPTION = "Where the skills live: a GitHub repository URL (https://github.com/<owner>/<repo>), a \"/tree/<ref>/<dir>\" link scoped to one directory, or the \"<owner>/<repo>\" shorthand.";
/** Shared parameter description for the directory narrowing. */
const SUBDIRECTORY_DESCRIPTION = "A directory inside the source to read instead of the whole thing, relative to the repository root (for example \"skills/rev-frida\"). Narrow this when a repository holds many skills and only one is wanted.";
/** Build the import tool, which previews a source and then installs from it. */
function importSkills(port, importer) {
	return defineTool({
		name: "skills_manager_import",
		description: "Install agent skills from a GitHub repository or a shared skill collection. Call it with only `source` first: it then returns every skill the source offers, with the real name from each SKILL.md, its description, and how many files and bytes it would write. Nothing is written on that call. Call it again with `skills` set to the names to install, and the harness downloads those skills' files, registers them, and publishes them to the skill catalog so the `skill` tool can load them by name. A repository may hold one skill at its root, many under \"skills/<name>/\", or a custom layout; the listing resolves that.",
		parameters: {
			source: {
				type: "string",
				required: true,
				description: SOURCE_DESCRIPTION
			},
			skills: {
				type: "array",
				items: { type: "string" },
				description: "The names to install, as returned by a preview call. Omit the parameter to preview instead of installing."
			},
			subdirectory: {
				type: "string",
				description: SUBDIRECTORY_DESCRIPTION
			}
		},
		output: jsonOutput(),
		async execute(args) {
			const names = args.skills ?? [];
			const target = {
				kind: "github",
				source: args.source,
				...args.subdirectory === void 0 ? {} : { subdirectory: args.subdirectory }
			};
			if (names.length === 0) return {
				mode: "preview",
				listing: await importer.preview(target)
			};
			const outcome = await importer.install(target, names);
			return {
				mode: "install",
				installed: outcome.installed,
				skipped: outcome.skipped,
				skills: port.list()
			};
		}
	});
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
/** Filesystem operations an install and a removal need; `node:fs/promises` satisfies it. */
const managerFs = {
	mkdir: (path, options) => mkdir(path, options),
	writeFile: (path, data) => writeFile(path, data),
	rm: (path, options) => rm(path, options)
};
/**
* Absolute root holding every imported skill's files.
*
* Deliberately a sibling of the harness home's `skills` directory rather than
* inside it: the shipped filesystem provider scans `<home>/skills` recursively
* and would publish every imported skill a second time, under a second
* provenance, which is exactly the duplicate the registry then has to rank.
* @returns the absolute directory the manager owns.
*/
function managedRoot() {
	return dshHomePath(MANAGED_FILES_DIR);
}
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
	const githubToken = config.githubToken;
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
			},
			resourceBaseOf: (skill) => skill.installed === void 0 ? void 0 : {
				kind: "directory",
				path: join(managedRoot(), skill.installed.directory)
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
		try {
			await removeSkillFiles({
				root: managedRoot(),
				name: skillName,
				fs: managerFs
			});
		} catch (error) {
			ctx.logger.warn(`skills-manager: could not delete the files for "${skillName}": ${String(error)}`);
		}
	};
	const setEnabled = async (skillName, enabled) => {
		const target = current.find((candidate) => candidate.name === skillName);
		if (target === void 0 || target.enabled !== false === enabled) return;
		await persist(current.map((candidate) => candidate.name === skillName ? {
			...candidate,
			enabled
		} : candidate));
	};
	const importer = {
		preview: (target) => listSkills(sourceOf(target), DEFAULT_LIMITS),
		async install(target, names) {
			const outcome = await installSkills({
				source: sourceOf(target),
				root: managedRoot(),
				names,
				fs: managerFs
			});
			const installed = [];
			for (const skill of outcome.installed) {
				await upsert(skill);
				installed.push(statusOf(skill));
			}
			return {
				installed,
				skipped: outcome.skipped
			};
		}
	};
	const port = {
		list,
		upsert,
		remove,
		setEnabled
	};
	if (toolsEnabled) for (const tool of managerTools(port, importer)) ctx.tools.register(tool);
	ctx.inject(["connection"], (connectionCtx) => {
		const connection = Reflect.get(connectionCtx, "connection");
		if (connection === void 0) return;
		connectionCtx.effect(() => connection.fetch.register({
			path: SKILLS_IMPORT_PATH,
			methods: ["POST"],
			requestBody: "buffered",
			fetch: (request) => importRoute(importer, request)
		}), "skills-manager: import route");
	});
	/** Build one readable source from the importer's transport-neutral target. */
	function sourceOf(target) {
		if (target.kind === "archive") return {
			kind: "archive",
			name: target.name,
			bytes: target.bytes
		};
		return {
			kind: "github",
			input: target.source,
			client: {
				fetch: (input, init) => globalThis.fetch(input, init),
				...githubToken === void 0 || githubToken.length === 0 ? {} : { token: githubToken }
			},
			...target.subdirectory === void 0 || target.subdirectory.length === 0 ? {} : { subdirectory: target.subdirectory }
		};
	}
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
