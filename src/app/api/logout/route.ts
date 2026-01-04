import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPool } from "@/lib/db";

function sessionCookieName(): string {
  return "next-auth.session-token";
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName())?.value;

  if (token) {
    const pool = getPool();
    await pool.query(`DELETE FROM sessions WHERE session_token = $1`, [token]);
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return res;
}
