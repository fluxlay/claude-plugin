#!/usr/bin/env node
// PostToolUse hook: validates fluxlay.yaml after Edit/Write/MultiEdit.
// Surfaces shallow schema errors (kind / slug / version / source extension)
// directly back to Claude so it can fix them in the same turn.
//
// On valid manifest: exit 0 silently.
// On error: print JSON with `decision: block` and the error list.

import fs from "node:fs";
import path from "node:path";

import { readScalars, validateManifest } from "./lib/manifest.mjs";

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function isManifestPath(p) {
  if (!p) return false;
  return path.basename(p) === "fluxlay.yaml";
}

function targetPaths(payload) {
  const input = payload?.tool_input ?? {};
  const out = [];
  if (typeof input.file_path === "string") out.push(input.file_path);
  if (Array.isArray(input.edits)) {
    for (const e of input.edits) if (typeof e?.file_path === "string") out.push(e.file_path);
  }
  return out.filter(isManifestPath);
}

try {
  const raw = await readStdin();
  const payload = raw.trim() ? JSON.parse(raw) : {};

  const paths = targetPaths(payload);
  if (paths.length === 0) process.exit(0);

  const allErrors = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const scalars = readScalars(text);
    const errors = validateManifest(scalars);
    if (errors.length > 0) {
      allErrors.push(`${p}:`);
      for (const e of errors) allErrors.push(`  - ${e}`);
    }
  }

  if (allErrors.length === 0) process.exit(0);

  const reason = [
    "fluxlay.yaml validation failed:",
    ...allErrors,
    "",
    "Fix these before running build/publish (the CLI runs the same checks and will refuse otherwise)."
  ].join("\n");

  process.stdout.write(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
} catch (err) {
  // Don't block on hook bugs — degrade gracefully.
  process.stderr.write(`[fluxlay validate-manifest hook] ${err?.message ?? err}\n`);
  process.exit(0);
}
