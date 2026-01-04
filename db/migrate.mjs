import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local deterministically for Node-run scripts
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const DATABASE_URL = requireEnv("DATABASE_URL");
const migrationsDir = path.join(__dirname, "migrations");

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    const appliedRes = await client.query(`SELECT name FROM schema_migrations`);
    const applied = new Set(appliedRes.rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");

      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
      process.stdout.write(`[db:migrate] applied ${file}\n`);
    }

    await client.query("COMMIT");
    process.stdout.write("[db:migrate] done\n");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db:migrate] failed:", err);
  process.exit(1);
});
