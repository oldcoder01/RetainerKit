import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { getPool } from "@/lib/db";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { CreateWorkLogForm } from "@/components/CreateWorkLogForm";
import { WorkLogsTable, type WorkLogListItem, type ContractOption } from "@/components/WorkLogsTable";

type ContractRow = {
  id: string;
  title: string;
  client_name: string;
};

type WorkLogRow = {
  id: string;
  contract_id: string;
  work_date: string;
  minutes: number;
  description: string;
  created_at: unknown;
  updated_at: unknown;
  contract_title: string;
  client_name: string;
};

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return new Date(0).toISOString();
  return dt.toISOString();
}

export default async function WorkPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const ws = await getActiveWorkspaceForUser(userId);
  const pool = getPool();

  const contractsRes = await pool.query<ContractRow>(
    `
      SELECT c.id, c.title, cl.name AS client_name
      FROM contracts c
      JOIN clients cl
        ON cl.id = c.client_id AND cl.workspace_id = c.workspace_id
      WHERE c.workspace_id = $1
      ORDER BY cl.name ASC, c.title ASC
    `,
    [ws.id]
  );

  const logsRes = await pool.query<WorkLogRow>(
    `
      SELECT
        wl.id,
        wl.contract_id,
        wl.work_date::text AS work_date,
        wl.minutes,
        wl.description,
        wl.created_at,
        wl.updated_at,
        c.title AS contract_title,
        cl.name AS client_name
      FROM work_logs wl
      JOIN contracts c
        ON c.id = wl.contract_id AND c.workspace_id = wl.workspace_id
      JOIN clients cl
        ON cl.id = c.client_id AND cl.workspace_id = c.workspace_id
      WHERE wl.workspace_id = $1
      ORDER BY wl.work_date DESC, wl.created_at DESC
      LIMIT 200
    `,
    [ws.id]
  );

  const contractOptions: ContractOption[] = contractsRes.rows.map((c) => {
    return { id: c.id, label: `${c.client_name} — ${c.title}` };
  });

  const workLogs: WorkLogListItem[] = logsRes.rows.map((w) => {
    return {
      id: w.id,
      contractId: w.contract_id,
      contractLabel: `${w.client_name} — ${w.contract_title}`,
      workDate: w.work_date,
      minutes: w.minutes,
      description: w.description,
      createdAt: toIsoString(w.created_at),
      updatedAt: toIsoString(w.updated_at),
    };
  });

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow">
        <div className="card-body space-y-2">
          <h1 className="text-2xl font-bold">Work</h1>
          <p className="text-sm text-base-content/70">
            Log time against contracts. Workspace: <span className="font-medium">{ws.name}</span>
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <CreateWorkLogForm contracts={contractOptions} />
        </div>
      </div>

      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="font-semibold">Recent logs</h2>

          {workLogs.length === 0 ? (
            <p className="text-sm text-base-content/70">No work logs yet.</p>
          ) : (
            <WorkLogsTable workLogs={workLogs} contracts={contractOptions} />
          )}
        </div>
      </div>
    </div>
  );
}
