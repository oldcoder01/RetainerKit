import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { ProjectsTable, type ProjectListItem } from "@/components/ProjectsTable";
import { getActiveWorkspaceForUser } from "@/lib/workspace";

type ProjectRow = {
  id: string;
  name: string;
  created_at: unknown;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();

  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return new Date(0).toISOString();

  return dt.toISOString();
}

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    // Portal layout already redirects, but keep it safe.
    return null;
  }

  const ws = await getActiveWorkspaceForUser(userId);
  const pool = getPool();
  const res = await pool.query<ProjectRow>(
    `SELECT id, name, created_at FROM projects WHERE workspace_id = $1 AND user_id = $2 ORDER BY created_at DESC`,
    [ws.id, userId]
  );

  const projects: ProjectListItem[] = res.rows.map((p) => {
    return {
      id: p.id,
      name: p.name,
      createdAt: toIsoString(p.created_at),
    };
  });

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-base-content/70">Minimal SQL-first CRUD: create + list scoped to your user.</p>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <CreateProjectForm />
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="font-semibold">Your projects</h2>

          {projects.length === 0 ? (
            <p className="text-sm text-base-content/70">No projects yet.</p>
          ) : (
            <ProjectsTable projects={projects} />
          )}
        </div>
      </div>
    </div>
  );
}
