"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LOGIN_PATH } from "./constants";
import { useAuthStore } from "./auth-store";

export const useIsAuthenticated = () => useAuthStore((s) => Boolean(s.token));
export const useCurrentUser = () => useAuthStore((s) => s.user);
/** Admin can create / update / delete; every other role is read-only. */
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === "admin");

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useCallback(() => {
    useAuthStore.getState().logout();
    queryClient.clear();
    router.replace(LOGIN_PATH);
  }, [router, queryClient]);
}
