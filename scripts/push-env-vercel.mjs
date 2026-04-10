/**
 * Reads .env.local and syncs vars to Vercel via CLI.
 * - Production: --sensitive (encrypted)
 * - Development: plain (Vercel disallows sensitive on Development)
 * Preview: CLI currently requires a Git branch / linked repo; add manually or use API + VERCEL_TOKEN.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const vercelCli = path.join(root, "node_modules", "vercel", "dist", "vc.js");

/** Vercel parses argv so values starting with "-" break `--value` + next arg; use `--value=x` or stdin. */
function runVercelEnvAdd(key, envName, val, sensitive) {
  const base = [
    vercelCli,
    "env",
    "add",
    key,
    envName,
    "--yes",
    "--force",
  ];
  if (sensitive) base.push("--sensitive");

  if (val.startsWith("-") || val.includes("\n") || val.includes("\r")) {
    const r = spawnSync(
      process.execPath,
      [...base],
      {
        cwd: root,
        input: val,
        encoding: "utf-8",
        stdio: ["pipe", "inherit", "inherit"],
        env: process.env,
      }
    );
    if (r.status !== 0) {
      throw new Error(`vercel env add failed: ${key} ${envName} (exit ${r.status})`);
    }
    return;
  }

  execFileSync(process.execPath, [...base, `--value=${val}`], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
}

const text = fs.readFileSync(envPath, "utf8");
const lines = text.split(/\r?\n/);
const seen = new Set();
const vars = [];

for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  const key = t.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  let val = t.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  if (seen.has(key)) continue;
  seen.add(key);
  vars.push({ key, val });
}

for (const { key, val } of vars) {
  runVercelEnvAdd(key, "production", val, true);
  console.log(`OK production: ${key}`);

  runVercelEnvAdd(key, "development", val, false);
  console.log(`OK development: ${key}`);
}

console.log(
  "\nDone. Preview was skipped (CLI needs linked Git + branch, or use Dashboard / REST API with VERCEL_TOKEN)."
);
