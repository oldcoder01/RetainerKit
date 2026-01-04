"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="btn btn-outline" onClick={() => void onSignOut()}>
      Sign out
    </button>
  );
}
