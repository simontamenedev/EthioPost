import { useMutation, useQuery } from "@tanstack/react-query";
import type { LoginValues } from "./schema";
import { TokenResponse, User } from "../../../lib/api/types";
import { ApiError } from "next/dist/server/api-utils";
import { useAuthStore } from "../../../lib/auth/auth-store";
import { api } from "../../../lib/api/client";

export const authKeys = { me: ["auth", "me"] as const };

/** POST /auth/login (form-encoded) → store token → GET /auth/me → store user. */
export function useLogin() {
  return useMutation<User, ApiError, LoginValues>({
    mutationFn: async ({ identifier, password, remember }) => {
      // The API accepts an email or a username.
      const form: Record<string, string> = identifier.includes("@")
        ? { email: identifier, password }
        : { username: identifier, password };
      const { access_token } = await api<TokenResponse>("/auth/login", { method: "POST", form, auth: false });

      const auth = useAuthStore.getState();
      auth.login(access_token, remember);
      try {
        const me = await api<User>("/auth/me");
        useAuthStore.getState().setUser(me);
        return me;
      } catch (error) {
        useAuthStore.getState().logout();
        throw error;
      }
    },
  });
}

/** Current user from the API (kept in sync with the zustand store). */
export function useMe(enabled: boolean) {
  return useQuery<User, ApiError>({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => api<User>("/auth/me", { signal }),
    enabled,
    staleTime: 60_000,
  });
}
