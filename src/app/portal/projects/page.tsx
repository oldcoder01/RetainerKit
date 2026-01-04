import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { CreateProjectForm } from "@/components/CreateProjectForm";

type ProjectRow = {
  id: string;
  name: string;
  created_at: Date;
};

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    // Portal layout already redirects, but keep it safe.
    return null;
  }

  const pool = getPool();
  const res = await pool.query<ProjectRow>(
    `SELECT id, name, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-base-content/70">
            Minimal SQL-first CRUD: create + list scoped to your user.
          </p>
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

          {res.rows.length === 0 ? (
            <p className="text-sm text-base-content/70">No projects yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-sm text-base-content/70">{new Date(p.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
