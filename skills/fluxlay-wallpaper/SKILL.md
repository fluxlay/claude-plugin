---
description: Fluxlay wallpaper development support. Provides @fluxlay/react SDK hooks, fluxlay.yaml manifest schema, runtime CSP constraints, @fluxlay/cli workflow, and common pitfalls. Reference this when the user asks to create, edit, or debug a Fluxlay wallpaper.
---

# Fluxlay Wallpaper Skill

Knowledge base for building [Fluxlay](https://fluxlay.com) wallpapers. Use this whenever the user is creating, editing, or debugging a wallpaper project.

## 1. Minimum project layout

A wallpaper's structure depends on its `kind`.

### `kind: web` (Vite + React SPA)

Project root must contain:

- `fluxlay.yaml` — manifest (required)
- `package.json` — depends on `@fluxlay/cli`, `@fluxlay/vite`, `@fluxlay/react`
- `vite.config.ts` — enables the `fluxlay()` Vite plugin
- `index.html` and `src/main.tsx` — entry point

### `kind: video` / `kind: image` (single media file)

Project root contains only:

- `fluxlay.yaml` — manifest with `source:` pointing to the media file
- The media file itself
  - `video`: `.mp4` or `.webm`
  - `image`: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

No Vite, no Node deps. CLI packages the file as `media.<ext>` directly. The desktop app generates a player HTML at delivery time.

For a brand-new project, run `/fluxlay:new` to scaffold the minimum template (it asks which kind).

## 2. `fluxlay.yaml` manifest

Top-level keys (the canonical 11): `schemaVersion`, `name`, `slug`, `version`, `kind`, `description`, `permissions`, `network`, `shell`, `properties`, `source`. `version` is **optional and ignored** — the store auto-assigns a revision on every publish, so it's kept only for backward compatibility (don't rely on it). Anything else (`icon`, `tags`, `author`, `license`, `homepage`, etc.) does **not exist** — don't invent fields.

```yaml
schemaVersion: 1            # currently only 1
name: My Wallpaper          # display name
slug: my-wallpaper          # unique URL-safe id (lowercase, digits, hyphens)
version: 0.1.0              # optional, ignored (store auto-assigns the revision)
kind: web                   # web | video | image (defaults to web if omitted, but build/publish require it explicitly)
description: |              # store listing
  ...
permissions:                # exhaustive enum: only "keyboard" and "ime-input" exist
  - keyboard
  - ime-input
network:                    # external origins. List of {origin, reason}.
  - origin: https://api.example.com   # scheme://host[:port], no path/query/wildcards/trailing slash
    reason: Why this host is needed (non-empty; shown to users at install time)
shell:                      # callable via useShell(id, ...). Map of id -> {run, reason?, required}.
  fetch-ip:
    run: curl -s https://httpbin.org/ip | jq -r '.origin'
    required: [curl, jq]    # REQUIRED field. Use [] if no binaries needed.
    reason: Display the public IP address.   # optional
properties:                 # see §2a — every entry needs `type:` AND `label:`
  themeColor:
    type: color
    label: Theme Color
    default: "#ffffff"
source: ./video.mp4         # ONLY for kind: video / image
```

**Schema gotchas** (these break validation):
- `network:` is a list of `{origin, reason}` **objects**, not bare URL strings. `reason` must be non-empty. Allowed schemes: `https` and `wss` only (encrypted) — plain `http` / `ws` are rejected. Origin = scheme + host[:port] only — no path, query, fragment, wildcard, or trailing slash.
- `shell:` is a **map** keyed by command id. Each entry needs `run` and `required` (use `[]` for none); `reason` is optional.
- Every entry under `properties:` requires both `type:` and `label:`.
- The legacy `type: string` was removed — use `text` (free input) or `select` (enum) instead. Validator emits a migration error.

### 2a. `properties:` types

Every property requires `type:` and `label:`. Required vs optional fields per type:

| `type` | Required (besides `type` + `label`) | Optional | Notes |
|---|---|---|---|
| `number` | `default` | `min`, `max`, `step` | All numeric |
| `range` | `default`, `min`, `max` | `step` | Slider UI |
| `color` | `default` | — | Hex: `#rgb`, `#rrggbb`, or `#rrggbbaa` |
| `boolean` | `default` | — | |
| `text` | `default` | `maxLength`, `placeholder` | Single-line input |
| `select` | `default`, `options: [{value, label}, ...]` | — | `default` must be one of the `value`s |
| `multi-select` | `default: [...]`, `options: [{value, label}, ...]` | `min`, `max` | `default` is an array |
| `image` | — | `accept: ["image/*"]`, `maxBytes` | No `default`. Value is host file path |
| `file` | — | `accept: ["audio/*"]`, `maxBytes` | No `default`. Value is host file path |
| `font` | `default` (family name), `sources: [system, google]` | `category: sans-serif \| serif \| monospace \| display \| handwriting` | If `sources` includes `google`, you **must** declare Google Fonts hosts under `network:` (`https://fonts.googleapis.com` and `https://fonts.gstatic.com`) |

`image` / `file` values come back as host file paths — pass them through `getPropertyFileUrl()` to load in the webview.

### 2b. video / image manifest

For `kind: video` / `kind: image` the Vite build is skipped and the file at `source` is packaged as-is. Minimal example:

```yaml
schemaVersion: 1
name: My Video Wallpaper
slug: my-video-wp
kind: video
source: ./background.mp4
```

Sections 3–5 (SDK, CSP, platform requirements) only apply to `kind: web`. For video/image, the only constraints are file extension and `source:` correctness.

## 3. SDK API (re-exported from `@fluxlay/react`)

### Input
- `useMousePosition(): {x, y}` — normalized to `[-1, 1]`. **Y is mathematical convention** (positive = up), opposite of CSS where Y grows downward.
- `useMouseEvents({ onButton?, onWheel? })` — clicks and wheel. Same `[-1, 1]` Y-up coordinates as `useMousePosition`.
- `useKeyboard({ onKeyDown?, onKeyUp? })` — global keystrokes from any window. Requires `permissions: [keyboard]`. `event.code` follows Web `KeyboardEvent.code` (`"KeyA"`, `"Space"`, etc., layout-independent).
- `useImeInput()` — IME-composed text. Requires `permissions: [ime-input]`. Returns `{ composition: string | null, cursor: number, activate(), deactivate(), onCommit(handler): cleanup }`. Auto-`deactivate` on unmount; while active, `useKeyboard` is paused on the same wallpaper to avoid double-firing IME candidate keys. Without the permission the hook is a no-op + one `console.warn` (no exception). **Note**: any `<input>` / `<textarea>` / `contenteditable` in a wallpaper transparently gets IME via a global handler registered at SDK import time — `useImeInput` is only needed for fully custom UIs.

### State
- `useProperties<T>(): T` — reactive values from `properties:` in the manifest.
- `getPropertyFileUrl(path: string | null): string | null` — converts an `image` / `file` property's host path to a webview URL.
- `useActiveElement()` — currently focused element within the wallpaper.
- `useIsFocused(ref: RefObject<HTMLElement>): boolean` — focus state of a specific element (takes a ref).

### System
- `useSystemMonitor(options?)` — returns CPU usage / per-core / frequency, memory + swap, network rx/tx, disk io, disk capacity per mount, battery level + charging, process count, load average. Options (all `*IntervalMs`, with defaults): `cpu` 500, `memory` 1000, `network` 1000, `diskIo` 2000, `diskSpace` 30000, `battery` 10000, `process` 10000, `loadAverage` 5000.
- `useAudio({ numBands? = 32 })` — `{ rms, peak, spectrum: number[] }`, all `[0, 1]`. Spectrum is A-weighted (IEC 61672) so frequency balance matches human hearing. macOS only requires audio capture permission (see §5).
- `useMediaMetadata({ intervalMs? = 1000 })` — `{ title, artist, album, artwork, duration, elapsedTime, playbackRate, isPlaying }`. `artwork` is a `data:image/...;base64,...` URL.
- `useShell(commandId, { refreshInterval? = 30000, terminal?, ... })` — runs a command declared under `shell:`. `refreshInterval: 0` disables auto-refresh. Can render output into an xterm terminal via `terminal:` option.
- `useTerminal(options?)` — xterm.js-backed terminal (`@xterm/xterm`). Returns `{ terminalRef, instance }`. `TerminalThemes` provides 13 built-in color themes.

### Network & host integration (imperative APIs)
- `proxiedFetch(input, init?): Promise<Response>` — fetch routed through the host process to bypass CORS for declared `network:` origins. Constraints: only `http` / `https`; max **10 MiB** response body; request strips `Cookie` / `Origin` / `Host` / `Referer`; only `Content-Type` / `Cache-Control` / `ETag` / `Last-Modified` are forwarded back. Use this for hosts that don't return `Access-Control-Allow-Origin` (e.g. ICS feeds).
- `runShell(commandId, options?): Promise<{ stdout, stderr, exitCode }>` — imperative twin of `useShell`. Same `shell:` declaration required.
- `openUrl(url): Promise<void>` — opens an external URL in the user's default browser (the **only** sanctioned way to navigate out of a wallpaper — `<a target="_blank">` won't work).
- `notify({ title, body, ... }): Promise<void>` — fires an OS notification.

Full reference: https://fluxlay.com/docs/developer/reference/sdk/use-mouse-position

## 4. Runtime constraints (CSP + isolation)

Each wallpaper runs in its own per-id origin (e.g. `fluxlay://<id>.wallpaper`) under a strict CSP. **Internalize before writing code**:

```
default-src   'none';                           # everything denied unless re-allowed below
script-src    'self';                           # NO 'unsafe-eval', NO 'unsafe-inline'
style-src     'self' 'unsafe-inline';           # React style={...} / CSS-in-JS OK
img-src       'self' data: blob: <network>;     # data:/blob: allowed; declared origins added
media-src     'self' blob: <network>;           # for <video>/<audio> from declared origins
font-src      'self' <network>;                 # add fonts.gstatic.com here for Google Fonts
connect-src   'self' http://127.0.0.1:* <network>;  # local API + declared origins
worker-src    'self' blob:;                     # Web Workers OK (self/blob only)
frame-ancestors 'none'; form-action 'none'; base-uri 'none'; object-src 'none';
```

`<network>` = origins declared under `network:` in the manifest. **They are injected into `connect-src`, `img-src`, `media-src`, and `font-src` only — never into `script-src`.** External JavaScript can never be loaded.

Practical implications:
- **No external `fetch` to undeclared hosts** — declare under `network:`. For non-CORS hosts, use `proxiedFetch`.
- **No `eval` / `new Function` / runtime template compilation** — many libraries break here. Dev mode loosens this, production does not. Always sanity-check with a build.
- **No `<a target="_blank">`, no `window.open(url)` for external URLs** — use `openUrl(url)`.
- **No `<form action>`, no `<iframe>`, no `<base>`, no `<object>` / `<embed>`** — these directives are `'none'`.
- **No Tauri capabilities** — wallpaper windows are excluded from every capability. `window.__TAURI__.core.invoke` is unavailable. All host interaction goes through SDK hooks / imperative APIs.
- **External images**: HTTPS image hosts work only if declared under `network:`. `data:` and `blob:` URIs work without declaration (this is how `useMediaMetadata().artwork` and `getPropertyFileUrl()` deliver bytes to the webview).

## 5. Platform requirements

- `useMouseEvents` / `useKeyboard`: macOS prompts the user to grant **Input Monitoring**. On Windows, events from elevated windows are not delivered (UIPI).
- `useAudio`: macOS uses the Core Audio Tap API; **macOS 14.2+** required, and `NSAudioCaptureUsageDescription` is prompted.

## 6. CLI workflow (`@fluxlay/cli`)

| Command | Purpose |
|---|---|
| `fluxlay login` | Device-auth login; opens a browser. |
| `fluxlay logout` | Clear stored session. |
| `fluxlay whoami` | Show current user. |
| `fluxlay dev [dir]` | Vite dev server with HMR. Writes `dev.json` to the app data dir; the desktop app reads it and renders the wallpaper from the dev URL. |
| `fluxlay build [dir] [-o name.fluxlay]` | Produce an encrypted `.fluxlay` package (default output `wallpaper.fluxlay`). |
| `fluxlay publish [dir]` | Build and upload to the Fluxlay store. No `kind` override flag. |

**Both `build` and `publish` require a logged-in session** (the developer key is fetched from the API). Only `dev` works offline. `build` and `publish` require a `kind` field in `fluxlay.yaml`.

If `fluxlay whoami` fails before `build` or `publish`, instruct the user to run `fluxlay login` interactively — do not run it on their behalf (it opens a browser and shows a confirmation code).

When the user asks for `dev`, `build`, or `publish` in Claude Code, run the corresponding script via the project's package manager (detect from the lockfile: `bun.lockb` → bun, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm).

### Pre-publish pre-flight checks

Before running the `publish` script, confirm with the user:

- For `kind: web`: they ran the `build` script and visually verified the wallpaper still renders correctly in the desktop app under production CSP (dev mode is looser).
- Each publish creates a **new server-assigned revision** — there's no `version` to bump, and re-publishing is always accepted (it ships a new revision).
- `slug` is final (renaming after publish creates a separate store listing).
- `kind` is final (changing it is a breaking change for existing users).
- `fluxlay whoami` succeeds.

The plugin also installs a `PreToolUse` hook that runs the same checks automatically when a `publish` command is detected, and asks the user to confirm. Treat the hook as a safety net — still walk through the checklist proactively.

## 7. Recommended implementation flow

1. Write `fluxlay.yaml` **first**: lock down `kind`, `slug`, `permissions`, and `network`.
2. Verify the design fits within the CSP constraints **before** writing React code.
3. Run the `dev` script and confirm behavior in the desktop app.
4. Run the `build` script to verify the wallpaper survives production CSP (dev is looser — always sanity-check with build).
5. Confirm `fluxlay login` succeeded, then run the `publish` script.

## 8. Common pitfalls checklist

- [ ] Calling an external API without declaring its host in `network:` → blocked by CSP in production.
- [ ] Declaring `network:` origin with a path/query/wildcard/trailing slash → manifest invalid.
- [ ] Using mouse Y as CSS Y → flipped image. Convert with `(1 - (y + 1) / 2) * height`.
- [ ] Adding `useKeyboard` without `permissions: [keyboard]` → backend returns HTTP 403, no events fire.
- [ ] Using `eval`-based libraries / runtime template engines → works in dev, breaks after build/publish.
- [ ] Using `<a target="_blank">` or `window.open(url)` for an external URL → silently fails. Use `openUrl(url)`.
- [ ] Using regular `fetch` for a non-CORS origin (even when declared under `network:`) → blocked by browser CORS. Use `proxiedFetch`.
- [ ] Treating `version` as meaningful (bumping it to release, expecting re-publish to be rejected) → it's ignored; the store auto-assigns a revision on every publish.
- [ ] Renaming `slug` after publishing → store treats it as a different app.
- [ ] Writing `network:` as `["https://..."]` instead of `[{origin: "...", reason: "..."}]` → manifest invalid.
- [ ] Defining a `properties:` entry without `label:` → manifest invalid.
- [ ] Writing `shell:` as a list instead of a map keyed by id, or omitting `required: []` → manifest invalid.
- [ ] Using `font` property with `sources: [google]` but no `https://fonts.googleapis.com` / `https://fonts.gstatic.com` under `network:` → fonts fail to load.
- [ ] Using legacy `type: string` for a property → validator rejects with migration hint to `text` / `select`.

## References

- Docs: https://fluxlay.com/docs/developer/tutorials/getting-started
- SDK reference: https://fluxlay.com/docs/developer/reference/sdk/use-mouse-position
- CLI reference: https://fluxlay.com/docs/developer/reference/cli/commands
- Manifest reference: https://fluxlay.com/docs/developer/reference/cli/manifest
- Examples: https://github.com/fluxlay/examples
