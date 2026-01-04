import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import Link from "next/link";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex w-full items-center justify-between">
            <Link href="/" className="btn btn-ghost text-xl">
              RetainerKit
            </Link>
            <div className="text-sm text-base-content/70">
              Signed in as <span className="font-mono">{session.user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
    </div>
  );
}
