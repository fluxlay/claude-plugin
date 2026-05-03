# Fluxlay Claude Code Plugin

A Claude Code plugin for building [Fluxlay](https://fluxlay.com) wallpapers — scaffold a project in one command, then let Claude write the wallpaper for you with full knowledge of the SDK and runtime constraints.

## What's included

- **Skill: `fluxlay-wallpaper`** — Domain knowledge about the `@fluxlay/react` SDK hooks, `fluxlay.yaml` manifest, runtime CSP constraints, and common pitfalls. Claude pulls this in automatically when you work on a Fluxlay wallpaper.
- **Slash command: `/fluxlay:new`** — Scaffold a new wallpaper project (`web` / `video` / `image`) from a minimal template, install dependencies, and initialize git.
- **Guardrail hooks**:
  - `PostToolUse` — every time Claude edits `fluxlay.yaml`, the manifest is shallow-validated (slug format, SemVer, `kind` enum, media `source` extension). Errors are surfaced back so Claude can fix them in the same turn.
  - `PreToolUse` — when a publish command (`fluxlay publish`, `npm run publish`, etc.) is about to run inside a wallpaper project, a pre-flight check verifies the manifest, build freshness (`web` kind), and `fluxlay whoami` login state. Hard failures deny the action; otherwise the user gets a confirmation prompt with a summary.

For `dev` / `build` / `publish` you can simply ask Claude in natural language ("start the dev server", "build and check it", "publish it") — the bundled skill knows the right `@fluxlay/cli` commands and the pre-flight checks to run.

## Installation

In Claude Code:

```text
/plugin marketplace add fluxlay/claude-plugin
/plugin install fluxlay@fluxlay
```

## Requirements

- [Claude Code](https://claude.com/claude-code)
- [Fluxlay desktop app](https://fluxlay.com/download) — for previewing wallpapers
- Node.js 20+ (any package manager: npm / pnpm / yarn / bun)
- A `fluxlay login` session (only needed when publishing)

## Usage

```text
/fluxlay:new                       # scaffold a new wallpaper project
```

Then describe what you want and let Claude build it. Examples:

> Add a CPU-usage bar that pulses in red when load goes above 80%.

> Make the background react to system audio with a frequency-spectrum visualizer.

## License

MIT
