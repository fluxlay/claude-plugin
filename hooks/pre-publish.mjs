#!/usr/bin/env node
// PreToolUse hook: intercepts Bash commands that publish a Fluxlay wallpaper
// (`fluxlay publish`, `npm run publish`, etc.) and forces a deliberate
// confirmation step backed by pre-flight checks.
//
// Decision logic:
//   - Not a publish command, or no fluxlay.yaml in cwd → exit 0 (allow silently).
//   - Hard failures (missing kind, no login, web kind with no build) → deny.
//   - Otherwise → ask, surfacing a summary so the user can confirm intentionally.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { readScalars, validateManifest } from "./lib/manifest.mjs";

const PUBLISH_PATTERNS = [
  // Direct CLI invocations (with optional npx/bunx/pnpm dlx prefix).
  /(^|[\s;&|])(npx|bunx|pnpm\s+dlx|yarn\s+dlx)?\s*fluxlay\s+publish\b/,
  // Package script invocations: `<pm> run publish`, `<pm> publish` (npm 7+ also accepts the latter).
  /(^|[\s;&|])(npm|pnpm|yarn|bun)\s+(run\s+)?publish\b/
];

function isPublishCommand(cmd) {
  if (typeof cmd !== "string") return false;
  return PUBLISH_PATTERNS.some(re => re.test(cmd));
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function decision(kind, reason) {
  // kind: "allow" | "deny" | "ask"
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: kind,
        permissionDecisionReason: reason
      }
    })
  );
  process.exit(0);
}

function isWebBuildFresh(root) {
  // dist/ must exist and be at least as new as the newest source file.
  const distDir = path.join(root, "dist");
  if (!fs.existsSync(distDir)) return { fresh: false, reason: "no dist/ — run the build script first" };
  const distMtime = newestMtime(distDir);
  const srcDir = path.join(root, "src");
  if (!fs.existsSync(srcDir)) return { fresh: true };
  const srcMtime = newestMtime(srcDir);
  if (srcMtime > distMtime) {
    return { fresh: false, reason: "src/ has changes newer than dist/ — re-run the build script" };
  }
  return { fresh: true };
}

function newestMtime(dir) {
  let max = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else {
        try {
          const m = fs.statSync(full).mtimeMs;
          if (m > max) max = m;
        } catch {}
      }
    }
  }
  return max;
}

function checkLogin() {
  const r = spawnSync("fluxlay", ["whoami"], { encoding: "utf8" });
  if (r.error) return { ok: null, note: "fluxlay CLI not on PATH (skipping login check)" };
  return { ok: r.status === 0, output: (r.stdout || r.stderr || "").trim() };
}

try {
  const raw = await readStdin();
  const payload = raw.trim() ? JSON.parse(raw) : {};
  if (payload.tool_name !== "Bash") process.exit(0);

  const cmd = payload.tool_input?.command;
  if (!isPublishCommand(cmd)) process.exit(0);

  const cwd = payload.cwd || process.cwd();
  const manifestPath = path.join(cwd, "fluxlay.yaml");
  if (!fs.existsSync(manifestPath)) process.exit(0); // Not a fluxlay project — stay out of the way.

  const scalars = readScalars(fs.readFileSync(manifestPath, "utf8"));
  const errors = validateManifest(scalars);
  if (errors.length > 0) {
    decision(
      "deny",
      [
        "Pre-publish check: fluxlay.yaml is invalid.",
        ...errors.map(e => `  - ${e}`),
        "Fix the manifest, then retry."
      ].join("\n")
    );
  }

  const findings = [];
  const blockers = [];

  // Web kind: build must be fresh.
  if (scalars.kind === "web") {
    const fresh = isWebBuildFresh(cwd);
    if (!fresh.fresh) blockers.push(`Build freshness: ${fresh.reason}`);
    else findings.push("Build freshness: dist/ is up to date");
  } else {
    findings.push(`Kind: ${scalars.kind} (no build freshness check)`);
  }

  // Login.
  const login = checkLogin();
  if (login.ok === false) blockers.push("Not logged in — run `fluxlay login` first");
  else if (login.ok === true) findings.push(`Logged in: ${login.output || "ok"}`);
  else findings.push(login.note);

  // Manifest summary.
  findings.push(
    `Manifest: name="${scalars.name}", slug="${scalars.slug}", kind=${scalars.kind}`
  );

  if (blockers.length > 0) {
    decision(
      "deny",
      ["Pre-publish check failed:", ...blockers.map(b => `  - ${b}`), "", "Findings:", ...findings.map(f => `  - ${f}`)].join("\n")
    );
  }

  decision(
    "ask",
    [
      "About to publish a Fluxlay wallpaper. This is public.",
      "",
      "Pre-flight summary:",
      ...findings.map(f => `  - ${f}`),
      "",
      "Reminders:",
      "  - Each publish creates a new server-assigned revision (no `version` to bump)",
      "  - Renaming `slug` after publish creates a separate store listing",
      "",
      `Command: ${cmd}`
    ].join("\n")
  );
} catch (err) {
  // Never block on hook bugs.
  process.stderr.write(`[fluxlay pre-publish hook] ${err?.message ?? err}\n`);
  process.exit(0);
}
