import type { ActiveWorkspace, WorkspaceRole } from "@/lib/workspace";

export function isContractorWorkspaceRole(role: WorkspaceRole): boolean {
  return role === "owner" || role === "contractor";
}

export function requireContractorWorkspace(ws: ActiveWorkspace): {
  ok: true;
} | {
  ok: false;
  status: number;
  error: string;
} {
  if (isContractorWorkspaceRole(ws.role)) {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: "Forbidden: client users cannot access contractor endpoints.",
  };
}
