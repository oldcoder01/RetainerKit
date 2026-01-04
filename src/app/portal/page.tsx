import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PortalPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <h1 className="text-2xl font-bold">Portal</h1>
        <p className="text-base-content/70">
          Server-gated page. If you can see this, database sessions + NextAuth v4 are working.
        </p>

        <div className="rounded bg-base-200 p-4 font-mono text-sm">
          <div>user.email: {session?.user?.email ?? "n/a"}</div>
          <div>user.name: {session?.user?.name ?? "n/a"}</div>
        </div>

        <div className="pt-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
