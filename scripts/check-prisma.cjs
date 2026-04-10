const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const envText = fs.readFileSync(filePath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!rawValue || process.env[key]) continue;

    let value = rawValue.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function normalizePostgresUrl(url) {
  if (!url || !url.startsWith("postgresql://")) return url;
  if (/sslmode=/i.test(url)) return url;
  if (url.includes("supabase.co") || url.includes("pooler.supabase.com")) {
    return url.includes("?") ? `${url}&sslmode=require` : `${url}?sslmode=require`;
  }
  return url;
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = normalizePostgresUrl(process.env.DATABASE_URL);
}

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma connected");
  } catch (err) {
    console.error("❌ Prisma connect failed:", err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
