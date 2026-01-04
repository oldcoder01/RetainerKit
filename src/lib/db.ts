import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __retainerkitPool: Pool | undefined;
}

function requireEnv(name: string): string {
  const v: string | undefined = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function getPool(): Pool {
  if (global.__retainerkitPool) {
    return global.__retainerkitPool;
  }

  const connectionString: string = requireEnv("DATABASE_URL");
  const pool: Pool = new Pool({ connectionString });

  global.__retainerkitPool = pool;
  return pool;
}
