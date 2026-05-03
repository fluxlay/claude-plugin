# __NAME__

A `kind: __KIND__` Fluxlay wallpaper.

## Add your media file

Place your media file at `__SOURCE__` (or update `source:` in `fluxlay.yaml`).

- `kind: video` accepts `.mp4` or `.webm`
- `kind: image` accepts `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

## Build & publish

`@fluxlay/cli` is required:

```sh
npm install -g @fluxlay/cli   # or bun add -g @fluxlay/cli

fluxlay login                 # one-time
fluxlay build                 # produce wallpaper.fluxlay
fluxlay publish               # upload to the store
```

> Note: both `build` and `publish` require a logged-in session.
