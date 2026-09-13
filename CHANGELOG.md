# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The version here, the `v<version>` git tag and the `version` field in
`package.json` always agree.

## [Unreleased]

## [0.2.0] - 2026-09-13

Import from a link or an archive. Until now a skill had to be typed in by hand;
this release reads a whole repository or a `.zip` and installs the skills it
finds, which is what makes the manager usable with the skill collections people
already publish on GitHub.

### Added

- **Import skills** in the **Settings → Skills** toolbar. Paste a GitHub
  repository address, an `owner/repo` shorthand, or a `/tree/<ref>/<dir>` link,
  or pick a local `.zip` archive, then press **Preview**.
- A preview listing that comes before anything is written: every skill the
  source offers, with its description, file count, size, and a note when a file
  limit left something out or a directory looks like a copy of another skill. A
  skill the host cannot install is listed with its reason and cannot be ticked.
- Per-skill checkboxes with **Select all** / **Select none**, plus the
  `install` half of the same dialog, so one repository of many skills does not
  need one gesture per skill. Everything installable starts ticked, so the
  common one-skill repository needs no second click.
- The `skills_manager_import` tool. Called with a source alone it previews;
  called with names as well it installs them, so the model can search a
  collection before committing to it.
- Archive support (`.zip`) with a single wrapping folder removed automatically,
  `__MACOSX`/`._*` noise filtered out, and the same per-skill and per-file
  limits the repository path uses.
- Repository and archive sources are described by the same listing, so the
  dialog, the tool, and the host route share one code path.
- **Config → `githubToken`.** GitHub answers anonymous API requests 60 times an
  hour per address, which one preview of a large collection can exhaust; a token
  raises the ceiling and is what makes a private repository readable.
- The result of an install is reported in place (`Installed N skills`), with the
  names that were left alone, and the list below the dialog refreshes through
  the settings document the host writes.

### Fixed

- `fflate` and `yaml` are declared as dependencies and
  `@deepseek-ai/dsh-home-paths` as a peer dependency. The host bundle imports
  all three, so a package that does not declare them only loads when the
  harness installation happens to carry the same libraries — which is how
  `0.1.2` worked by accident and would stop working on a narrower install.

## [0.1.2] - 2026-09-13

Republished. The npm package was deleted from the registry, and npm refuses to
reuse a version number that has already existed, so the same artifact ships under
a new patch number. Nothing changed in the published payload (`lib/`,
`cordis.patch.yml`, the READMEs and the licence are byte-identical to `0.1.1`).

### Changed

- `0.1.2` supersedes `0.1.1` as the `latest` tag. Install or upgrade with
  `dsh plugin --profile web add @ctl456/dsh-skills-manager`.

## [0.1.1] - 2026-09-13

The first usable release. `0.1.0` was a withdrawn draft that shipped a
hand-rolled bundle the harness could not load; it is superseded by this version.

### Added

- `@ctl456/dsh-skills-manager`: an opt-in DeepSeek Harness bundle that keeps one
  list of agent skills and registers them through a single `ctx.skills`
  provider, so the harness's own `skill` tool loads each enabled skill exactly
  like one discovered from a `SKILL.md` file.
- A dedicated **Settings → Skills** page, below **Agent presets**, with a search
  box, a list that pages five skills at a time, and one add/edit dialog carrying
  the name, description, when-to-use note, instruction body, and the model and
  slash invocation switches.
- The `skills_manager_list`, `skills_manager_add`, `skills_manager_remove` and
  `skills_manager_set_enabled` tools, which manage the same `skills-manager`
  section of `$DSH_HOME/settings.yaml` from chat.

## [0.1.0] - 2026-09-13

### Withdrawn

- Never usable: the published artifact was built outside the harness toolchain,
  so the client half never registered and the host half did not compose its
  Profile row.

[Unreleased]: https://github.com/ctl456/dsh-skills-manager/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ctl456/dsh-skills-manager/releases/tag/v0.2.0
[0.1.2]: https://github.com/ctl456/dsh-skills-manager/releases/tag/v0.1.2
[0.1.1]: https://github.com/ctl456/dsh-skills-manager/releases/tag/v0.1.1
[0.1.0]: https://www.npmjs.com/package/@ctl456/dsh-skills-manager/v/0.1.0
