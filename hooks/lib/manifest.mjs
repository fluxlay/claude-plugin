// Minimal YAML reader for the small subset of fluxlay.yaml we care about:
// top-level scalar keys (schemaVersion, name, slug, kind, source).
// Anything more complex (lists, nested maps) is intentionally ignored — the
// CLI's native validator is canonical; this hook is just a fast feedback loop.

export function readScalars(yamlText) {
  const out = {};
  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim() || line.startsWith(" ") || line.startsWith("\t") || line.startsWith("-")) continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value === "" || value === "|" || value === ">") continue; // block scalar or container
    value = value.replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

const KIND_VALUES = new Set(["web", "video", "image"]);
const VIDEO_EXT = new Set(["mp4", "webm"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

export function validateManifest(scalars) {
  const errors = [];

  if (scalars.schemaVersion !== "1") {
    errors.push(`schemaVersion must be 1 (got ${JSON.stringify(scalars.schemaVersion ?? null)})`);
  }
  if (!scalars.name) errors.push("name is required");
  if (!scalars.slug) {
    errors.push("slug is required");
  } else if (!/^[a-z0-9][a-z0-9-]*$/.test(scalars.slug)) {
    errors.push(`slug must match /^[a-z0-9][a-z0-9-]*$/ (got ${JSON.stringify(scalars.slug)})`);
  }
  // version は任意。リビジョンは publish 時にサーバーが自動採番するため、
  // 記述されても無視される（後方互換でフィールド自体は許容）。検証しない。
  if (!scalars.kind) {
    errors.push("kind is required (one of: web, video, image)");
  } else if (!KIND_VALUES.has(scalars.kind)) {
    errors.push(`kind must be web | video | image (got ${JSON.stringify(scalars.kind)})`);
  }

  if (scalars.kind === "video" || scalars.kind === "image") {
    if (!scalars.source) {
      errors.push(`kind: ${scalars.kind} requires source: pointing to the media file`);
    } else {
      const ext = scalars.source.split(".").pop()?.toLowerCase() ?? "";
      const allowed = scalars.kind === "video" ? VIDEO_EXT : IMAGE_EXT;
      if (!allowed.has(ext)) {
        errors.push(
          `kind: ${scalars.kind} requires source extension in {${[...allowed].join(", ")}} (got .${ext})`
        );
      }
    }
  }

  return errors;
}
