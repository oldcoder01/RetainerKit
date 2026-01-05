import { getPool } from "@/lib/db";

export type ClientRole = "client_admin" | "client_user";

export type ActiveClient = {
  id: string;
  name: string;
  role: ClientRole;
};

type ClientRow = {
  id: string;
  name: string;
  role: ClientRole;
};

/**
 * Returns the user's "active" client inside a workspace.
 *
 * For now: pick the earliest membership as a stable default.
 * Later, we can add an explicit "active client" selector stored in a cookie.
 */
export async function getActiveClientForUserInWorkspace(
  userId: string,
  workspaceId: string
): Promise<ActiveClient | null> {
  const pool = getPool();

  const res = await pool.query<ClientRow>(
    `
      SELECT c.id, c.name, cm.client_role AS role
      FROM client_members cm
      JOIN clients c ON c.id = cm.client_id
      WHERE cm.user_id = $1
        AND c.workspace_id = $2
      ORDER BY cm.created_at ASC, c.created_at ASC, c.id ASC
      LIMIT 1
    `,
    [userId, workspaceId]
  );

  if (!res.rowCount || res.rowCount < 1) return null;

  return {
    id: res.rows[0].id,
    name: res.rows[0].name,
    role: res.rows[0].role,
  };
}
