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
import { type SourceListing } from './source.ts';
import type { ImportPort, SkillStatus } from './tools.ts';
/** Absolute path of the card's import route, below the shared `/api` channel. */
export declare const SKILLS_IMPORT_PATH = "/api/skills-manager.import";
/** Largest archive the card may send, in bytes, before base64 expansion. */
export declare const MAX_ARCHIVE_BYTES: number;
/** What a preview request answers with. */
export interface ImportPreviewResponse {
    /** Discriminator for the response union. */
    readonly ok: true;
    /** Which gesture this answered. */
    readonly action: 'preview';
    /** Every skill the source offers. */
    readonly listing: SourceListing;
}
/** What an install request answers with. */
export interface ImportInstallResponse {
    /** Discriminator for the response union. */
    readonly ok: true;
    /** Which gesture this answered. */
    readonly action: 'install';
    /** The entries that were written and are now in the registry. */
    readonly installed: readonly SkillStatus[];
    /** Names that produced nothing, with the reason. */
    readonly skipped: readonly {
        readonly name: string;
        readonly reason: string;
    }[];
}
/** What a refused import answers with. */
export interface ImportFailureResponse {
    /** Discriminator for the response union. */
    readonly ok: false;
    /** Stable problem code, so the card can pick the right advice. */
    readonly problem: string;
    /** Human-readable detail; already free of host paths and credentials. */
    readonly message: string;
}
/** Everything the route can answer. */
export type ImportResponse = ImportPreviewResponse | ImportInstallResponse | ImportFailureResponse;
/**
 * Handle one import request.
 * @param importer - the host importer the route drives.
 * @param request - the decoded request; its body must be JSON.
 * @returns a JSON response, always with a `ok` discriminator.
 */
export declare function importRoute(importer: ImportPort, request: Request): Promise<Response>;
//# sourceMappingURL=route.d.ts.map