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

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(`DROP SCHEMA IF EXISTS public CASCADE;`);
    await client.query(`CREATE SCHEMA public;`);
    await client.query(`GRANT ALL ON SCHEMA public TO retainerkit;`);
    await client.query(`GRANT ALL ON SCHEMA public TO public;`);

    await client.query("COMMIT");
    process.stdout.write("[db:reset] dropped and recreated public schema\n");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[db:reset] failed:", err);
  process.exit(1);
});
