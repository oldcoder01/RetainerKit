import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { randomBytes } from "crypto";
import { getPool } from "@/lib/db";

type LoginBody = {
  email?: string;
  password?: string;
};

type DbUserRow = {
  id: string;
  email: string;
  password_hash: string | null;
};

function sessionCookieName(): string {
  // http://localhost => non-secure cookie name
  return "next-auth.session-token";
}

export async function POST(req: Request) {
  const body = (await req.json()) as LoginBody;

  const email: string = (body.email ?? "").trim().toLowerCase();
  const password: string = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const pool = getPool();

  const userRes = await pool.query<DbUserRow>(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email]
  );

  if (userRes.rowCount === 0) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const user = userRes.rows[0];
  if (!user.password_hash) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const ok = await compare(password, user.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const sessionToken: string = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO sessions (session_token, user_id, expires) VALUES ($1, $2, $3)`,
    [sessionToken, user.id, expires]
  );

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(sessionCookieName(), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return res;
}
