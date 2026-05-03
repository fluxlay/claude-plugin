---
description: Plan and scaffold a new Fluxlay wallpaper project from an idea
argument-hint: "[describe the wallpaper you want to build]"
---

Plan and scaffold a new Fluxlay wallpaper from a free-form description, then start implementing it.

## Inputs

- `$ARGUMENTS` — natural-language description of the wallpaper the user wants to build (e.g. "a breathing circle whose color tracks CPU usage", "video wallpaper that loops a forest clip"). If empty, ask the user what they want to build before doing anything else. Do not assume.

## Phase 1: Discovery (do this BEFORE writing any files)

Use the `fluxlay-wallpaper` skill as your reference. From the description, propose a concrete plan and present it to the user. Cover:

1. **`kind` recommendation** with rationale:
   - `web` — anything with logic, animation, or SDK hooks (CPU bars, clocks, audio visualizers, mouse-reactive scenes, etc.)
   - `video` — the user just wants to loop an existing `.mp4` / `.webm`
   - `image` — the user just wants a static `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif`
2. **Naming**:
   - `slug` — kebab-case, derived from the description (e.g. `cpu-breathing-circle`)
   - `name` — Title Case display name
   - `directory` — same as `slug` by default; let the user override
3. **For `kind: web` only**, list the SDK surface and constraints up front:
   - SDK hooks you plan to use (e.g. `useSystemMonitor`, `useMousePosition`, `useAudio`)
   - Required `permissions:` entries (`keyboard`, `ime-input`)
   - Required `network:` entries (any external host the wallpaper will fetch from)
   - CSP / pitfall flags relevant to the idea (external fetch, `eval`-based libs, mouse Y inversion, etc. — see SKILL.md §4 and §8)
4. **Implementation sketch** — 1–3 sentences on the component structure or rendering approach.

Present this as a brief, scannable summary and ask the user to confirm or adjust. Examples of things they might tweak: kind, naming, scope ("just bars no animation"), or adding/removing features.

**Do not proceed to scaffold until the user confirms.**

## Phase 2: Scaffold

Once confirmed:

1. Resolve the target directory. If it already exists and is non-empty, stop and ask how to proceed.
2. Copy the appropriate template into the target directory:
   - `web` → `${CLAUDE_PLUGIN_ROOT}/templates/web-react/`
   - `video` / `image` → `${CLAUDE_PLUGIN_ROOT}/templates/media/`
   Preserve `.gitignore`.
3. Replace placeholders in copied files:
   - `__NAME__`, `__SLUG__` (always)
   - `__KIND__`, `__SOURCE__` (only video/image; pick a sensible default extension — e.g. `./background.mp4` for video, `./background.png` for image)
4. Apply the discovery output to `fluxlay.yaml`:
   - Add `permissions:` entries for any SDK hooks that require them (`useKeyboard` → `keyboard`, `useImeInput` → `ime-input`)
   - Add `network:` entries for any external hosts identified
5. Per-kind follow-up:
   - **web**: install dependencies. Detect package manager from any existing lockfile in the parent context (`bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm). If unknown, ask; default preference: bun → pnpm → npm.
     ```sh
     cd <target> && <pm> install
     ```
   - **video / image**: skip install. Tell the user where to drop the media file (matching `source:` in `fluxlay.yaml`).
6. Initialize git in the new directory if it isn't already inside a git repo, and make an initial commit (`chore: scaffold fluxlay wallpaper`).

## Phase 3: Implement

For `kind: web`, immediately start implementing the wallpaper per the confirmed plan:

- Edit `src/main.tsx` (and add additional files only if the structure justifies it).
- Use the SDK hooks identified in discovery.
- Honor the CSP constraints (`fluxlay-wallpaper` skill §4).
- After the first cut, suggest the user run the `dev` script to see it live (the Fluxlay desktop app must be running) and iterate from there.

For `kind: video` / `image`, implementation is dropping the media file at `source:`. Tell the user when they're ready to `fluxlay build` (login required).

Do not modify files outside the target directory.
