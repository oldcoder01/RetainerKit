import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";

type ProjectRow = {
  id: string;
  name: string;
  created_at: Date;
};

type CreateBody = {
  name?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  const res = await pool.query<ProjectRow>(
    `SELECT id, name, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
    [session.user.id]
  );

  return NextResponse.json({ projects: res.rows }, { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateBody;
  const name = (body.name ?? "").trim();

  if (name.length < 1 || name.length > 120) {
    return NextResponse.json({ error: "Project name must be 1–120 characters." }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query<ProjectRow>(
    `INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at`,
    [session.user.id, name]
  );

  return NextResponse.json({ project: res.rows[0] }, { status: 201 });
}
