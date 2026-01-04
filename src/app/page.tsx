import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-base-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h1 className="text-3xl font-bold">RetainerKit</h1>
            <p className="text-base-content/70">
              SQL-first client portal starter (Next.js + NextAuth + Postgres)
            </p>

            <div className="mt-6 flex gap-3">
              <Link className="btn btn-primary" href="/portal">
                Go to Portal
              </Link>
              <Link className="btn btn-outline" href="/login">
                Login
              </Link>
              <Link className="btn btn-ghost" href="/register">
                Register
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-base-content/60">
          Local dev URL: <span className="font-mono">http://localhost:3000</span>
        </div>
      </div>
    </main>
  );
}
