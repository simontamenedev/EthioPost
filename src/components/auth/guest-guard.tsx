"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/auth/auth-store";
import { HOME_PATH } from "../../lib/auth/constants";
import { FullPageSpinner } from "../ui/spinner";

/** Only allow same-site relative paths ("/x", never "//evil.com"). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : HOME_PATH;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (hasHydrated && token) {
      // honour ?next= so a fresh login lands where the user was headed
      const next = safeNext(new URLSearchParams(window.location.search).get("next"));
      router.replace(next);
    }
  }, [hasHydrated, token, router]);

  if (!hasHydrated || token) return <FullPageSpinner label="Redirecting…" />;
  return <>{children}</>;
}