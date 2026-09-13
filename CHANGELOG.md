# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The version here, the `v<version>` git tag and the `version` field in
`package.json` always agree.

## [Unreleased]

## [0.1.0] - 2026-09-13

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

[Unreleased]: https://github.com/ctl456/dsh-skills-manager/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ctl456/dsh-skills-manager/releases/tag/v0.1.0
