import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";
import { clearSessionCookies, getSessionTokenFromCookies } from "@/lib/auth/session-cookie";

export async function POST() {
  const cookieStore = await cookies();
  const token = getSessionTokenFromCookies(cookieStore);

  if (token) {
    const pool = getPool();
    await pool.query(`DELETE FROM sessions WHERE session_token = $1`, [token]);
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookies(res);
  return res;
}
