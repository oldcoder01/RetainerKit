"use client";

import { useEffect, useMemo, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ProviderInfo = {
  id: string;
  name: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Record<string, ProviderInfo> | null>(null);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    void (async () => {
      const p = await getProviders();
      if (!p) {
        setProviders({});
        return;
      }

      // Only keep oauth providers
      const filtered: Record<string, ProviderInfo> = {};
      for (const k of Object.keys(p)) {
        if (k !== "credentials") {
          filtered[k] = { id: p[k].id, name: p[k].name };
        }
      }
      setProviders(filtered);
    })();
  }, []);

  const oauthButtons = useMemo(() => {
    if (!providers) {
      return null;
    }
    const keys = Object.keys(providers);
    if (keys.length === 0) {
      return null;
    }
    return (
      <div className="space-y-2">
        {keys.map((k) => (
          <button
            key={k}
            className="btn btn-outline w-full"
            onClick={() => void signIn(k, { callbackUrl: "/portal" })}
          >
            Continue with {providers[k].name}
          </button>
        ))}
      </div>
    );
  }, [providers]);

  async function onCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError("Invalid email or password.");
        return;
      }

      router.push("/portal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-base-200">
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-4">
            <h1 className="text-2xl font-bold">Login</h1>

            {oauthButtons}

            {oauthButtons ? <div className="divider">OR</div> : null}

            <form className="space-y-3" onSubmit={onCredentialsSubmit}>
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Email</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Password</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  type="password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              {error ? <div className="alert alert-error">{error}</div> : null}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="text-sm">
              No account?{" "}
              <Link className="link" href="/register">
                Register
              </Link>
            </div>

            <div className="text-xs text-base-content/60">
              Use <span className="font-mono">http://localhost:3000</span> for local dev (cookie-safe).
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
