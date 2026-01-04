import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { getPool } from "@/lib/db";

type RegisterBody = {
  name?: string;
  email?: string;
  password?: string;
};

type PgErrorLike = {
  code?: string;
};

function isPgErrorLike(err: unknown): err is PgErrorLike {
  return typeof err === "object" && err !== null && "code" in err;
}

export async function POST(req: Request) {
  const body = (await req.json()) as RegisterBody;

  const name: string = (body.name ?? "").trim();
  const email: string = (body.email ?? "").trim().toLowerCase();
  const password: string = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const passwordHash: string = await hash(password, 12);
  const pool = getPool();

  try {
    const res = await pool.query(
      `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, email
      `,
      [name || null, email, passwordHash]
    );

    return NextResponse.json({ id: res.rows[0].id, email: res.rows[0].email }, { status: 201 });
  } catch (err: unknown) {
    if (isPgErrorLike(err) && err.code === "23505") {
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed." }, { status: 500 });
  }
}
