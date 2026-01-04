import { getPool } from "@/lib/db";

export type WorkspaceRole = "owner" | "contractor" | "client";

export type ActiveWorkspace = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

type WorkspaceRow = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

function roleRank(role: WorkspaceRole): number {
  if (role === "owner") return 3;
  if (role === "contractor") return 2;
  return 1;
}

/**
 * Returns the "active" workspace for the user.
 * For now: pick the highest-privilege membership (owner > contractor > client),
 * earliest membership as tie-breaker.
 *
 * Safety: if user somehow has no membership, create a default workspace + owner membership.
 * (This should not happen after migration, but keeps the app robust.)
 */
export async function getActiveWorkspaceForUser(userId: string): Promise<ActiveWorkspace> {
  const pool = getPool();

  const res = await pool.query<WorkspaceRow>(
    `
      SELECT w.id, w.name, wm.role
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = $1
    `,
    [userId]
  );

  if (res.rowCount && res.rowCount > 0) {
    const sorted = res.rows
      .slice()
      .sort((a, b) => roleRank(b.role) - roleRank(a.role) || a.id.localeCompare(b.id));
    return sorted[0];
  }

  // Fallback: create a default workspace for this user (owner)
  const created = await pool.query<WorkspaceRow>(
    `
      WITH u AS (
        SELECT id, COALESCE(NULLIF(name, ''), split_part(email, '@', 1)) AS base
        FROM users
        WHERE id = $1
      ),
      w AS (
        INSERT INTO workspaces (owner_user_id, name)
        SELECT u.id, (u.base || '''s Workspace') FROM u
        ON CONFLICT (owner_user_id) DO UPDATE SET name = workspaces.name
        RETURNING id, name
      ),
      m AS (
        INSERT INTO workspace_members (workspace_id, user_id, role)
        SELECT w.id, $1, 'owner' FROM w
        ON CONFLICT (workspace_id, user_id) DO NOTHING
      )
      SELECT w.id, w.name, 'owner'::text AS role
      FROM w
    `,
    [userId]
  );

  return created.rows[0];
}
