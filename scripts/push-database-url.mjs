/**
 * Pushes only DATABASE_URL + DIRECT_URL from .env.local to Vercel (production + development).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");
const vercelCli = path.join(root, "node_modules", "vercel", "dist", "vc.js");

function getVal(txt, key) {
  const m = txt.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!m) return null;
  let v = m[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function runAdd(key, envName, val, sensitive) {
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

  const needsStdin =
    val.startsWith("-") || val.includes("\n") || val.includes("\r");

  if (needsStdin || val.includes("&")) {
    const r = spawnSync(process.execPath, [...base], {
      cwd: root,
      input: val,
      encoding: "utf-8",
      stdio: ["pipe", "inherit", "inherit"],
      env: process.env,
    });
    if (r.status !== 0) {
      throw new Error(`vercel env add failed: ${key} ${envName}`);
    }
    return;
  }

  execFileSync(process.execPath, [...base, `--value=${val}`], {
    cwd: root,
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
}

const txt = fs.readFileSync(envPath, "utf8");
const databaseUrl = getVal(txt, "DATABASE_URL");
const directUrl = getVal(txt, "DIRECT_URL");

if (!databaseUrl || !directUrl) {
  console.error("Missing DATABASE_URL or DIRECT_URL in .env.local");
  process.exit(1);
}

for (const envName of ["production", "development"]) {
  const sens = envName === "production";
  runAdd("DATABASE_URL", envName, databaseUrl, sens);
  console.log(`OK DATABASE_URL (${envName})`);
  runAdd("DIRECT_URL", envName, directUrl, sens);
  console.log(`OK DIRECT_URL (${envName})`);
}

console.log("Done.");
