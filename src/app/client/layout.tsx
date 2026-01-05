import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth/options";
import { getActiveWorkspaceForUser } from "@/lib/workspace";
import { getActiveClientForUserInWorkspace } from "@/lib/client";
import { SignOutButton } from "@/components/SignOutButton";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const ws = await getActiveWorkspaceForUser(session.user.id);

  // Contractor users live in /portal.
  if (ws.role !== "client") {
    redirect("/portal");
  }

  const client = await getActiveClientForUserInWorkspace(session.user.id, ws.id);

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/client" className="btn btn-ghost text-xl">
                RetainerKit
              </Link>

              <div className="hidden gap-1 sm:flex">
                <Link href="/client" className="btn btn-ghost btn-sm">
                  Dashboard
                </Link>
                <Link href="/client/invoices" className="btn btn-ghost btn-sm">
                  Invoices
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-sm text-base-content/70 sm:block">
                <div>
                  Workspace: <span className="font-medium">{ws.name}</span>
                </div>
                <div>
                  Client: <span className="font-medium">{client?.name ?? "(none)"}</span>
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}
