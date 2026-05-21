"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LogoutButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      const client = getSupabaseBrowserClient();

      if (client) {
        await client.auth.signOut();
      } else {
        await fetch("/api/auth/logout", { method: "POST" });
      }

      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <button className="button" type="button" onClick={handleLogout} disabled={isPending}>
      {isPending ? "退出中" : "退出"}
    </button>
  );
}
