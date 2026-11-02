"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/auth/auth-store";
import { useMe } from "../../app/features/auth/hooks";
import { LOGIN_PATH } from "../../lib/auth/constants";
import { FullPageSpinner } from "../ui/spinner";
import { Button } from "../ui/button";

/**
 * Client-side guard: wait for the persisted session to load, send guests to /login,
 * and refresh the current user (role) from GET /auth/me. proxy.ts does the same redirect
 * on the server for first paint; this one is the source of truth.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const me = useMe(hasHydrated && Boolean(token));

  useEffect(() => {
    if (me.data) setUser(me.data);
  }, [me.data, setUser]);
useEffect(() => {
  // adjust to your api client's error shape (status / statusCode)
  const status = (me.error as { status?: number } | null)?.status;
  if (status === 401) {
    logout();
    router.replace(LOGIN_PATH);
  }
}, [me.error, logout, router]);
  useEffect(() => {
    if (hasHydrated && !token) {
      logout(); // also clears the proxy cookie so /login isn't bounced back
      router.replace(LOGIN_PATH);
    }
  }, [hasHydrated, token, logout, router]);

  if (!hasHydrated || !token) return <FullPageSpinner label="Checking your session…" />;

  if (!user) {
    if (me.isError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center dark:bg-[#0d1040]">
          <p className="text-sm font-semibold text-slate-800 dark:text-white">We couldn’t load your account.</p>
          <p className="text-xs text-slate-600 dark:text-white/70">{me.error.message}</p>
          <Button variant="primary" onClick={() => void me.refetch()}>Try again</Button>
        </div>
      );
    }
    return <FullPageSpinner label="Loading your account…" />;
  }

  return <>{children}</>;
}
