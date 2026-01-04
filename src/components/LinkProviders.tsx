"use client";

import { signIn } from "next-auth/react";

export function LinkProviders() {
  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body space-y-3">
        <h3 className="font-semibold">Link providers</h3>

        <button
          className="btn btn-outline w-full"
          onClick={() => void signIn("github", { callbackUrl: "/portal/account" })}
        >
          Link GitHub
        </button>

        <button
          className="btn btn-outline w-full"
          onClick={() => void signIn("google", { callbackUrl: "/portal/account" })}
        >
          Link Google
        </button>

        <div className="text-xs text-base-content/60">
          You must be signed in for linking to work.
        </div>
      </div>
    </div>
  );
}
