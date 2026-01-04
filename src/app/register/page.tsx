"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ApiError = { error?: string };

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data: ApiError | null = await res.json().catch(() => null);
        setError(data?.error ?? "Registration failed.");
        return;
      }

      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        setError("Account created, but auto-login failed. Please login.");
        router.push("/login");
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
            <h1 className="text-2xl font-bold">Register</h1>

            <form className="space-y-3" onSubmit={onSubmit}>
              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Name (optional)</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  type="text"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  autoComplete="name"
                />
              </label>

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
                  <span className="label-text">Password (min 8 chars)</span>
                </div>
                <input
                  className="input input-bordered w-full"
                  type="password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              {error ? <div className="alert alert-error">{error}</div> : null}

              <button className="btn btn-primary w-full" type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create account"}
              </button>
            </form>

            <div className="text-sm">
              Already have an account?{" "}
              <Link className="link" href="/login">
                Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
