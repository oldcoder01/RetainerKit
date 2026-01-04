import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

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
            <div className="flex items-center gap-2">
              <Link href="/" className="btn btn-ghost text-xl">
                RetainerKit
              </Link>

              <div className="hidden gap-1 sm:flex">
                <Link href="/portal" className="btn btn-ghost btn-sm">
                  Portal
                </Link>
                <Link href="/portal/projects" className="btn btn-ghost btn-sm">
                  Projects
                </Link>
                <Link href="/portal/account" className="btn btn-ghost btn-sm">
                  Account
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-sm text-base-content/70 sm:block">
                Signed in as <span className="font-mono">{session.user?.email}</span>
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
