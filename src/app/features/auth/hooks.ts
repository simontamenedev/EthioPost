import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LoginValues } from "./schema";
import { TokenResponse, User } from "../../../lib/api/types";
import { ApiError } from "next/dist/server/api-utils";
import { useAuthStore } from "../../../lib/auth/auth-store";
import { api } from "../../../lib/api/client";
import { useCallback } from "react";
import { LOGIN_PATH } from "../../../lib/auth/constants";
import { useRouter } from "next/navigation";

export const authKeys = { me: ["auth", "me"] as const };

type Message = { message: string };
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

/** Clears token, cookie, persisted storage and cached queries, then goes to /login. */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(() => {
    useAuthStore.getState().logout();      // clears the proxy cookie + token/user in the store
    useAuthStore.persist.clearStorage();   // removes the persisted copy (local + session)
    queryClient.clear();                   // drop cached /auth/me and all other data
    router.replace(LOGIN_PATH);
    router.refresh();                      // invalidate the client router cache
  }, [queryClient, router]);
}

export function useForgotPassword() {
  return useMutation<Message, ApiError, { email: string }>({
    mutationFn: (body) => api<Message>("/auth/forgot-password", { method: "POST", json: body, auth: false }),
  });
}

export function useResetPassword() {
  return useMutation<Message, ApiError, { token: string; new_password: string }>({
    mutationFn: (body) => api<Message>("/auth/reset-password", { method: "POST", json: body, auth: false }),
  });
}

export function useChangePassword() {
  return useMutation<Message, ApiError, { current_password: string; new_password: string }>({
    mutationFn: (body) => api<Message>("/auth/change-password", { method: "POST", json: body }),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<User, ApiError, { name: string }>({
    mutationFn: (body) => api<User>("/auth/me", { method: "PATCH", json: body }),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user); // sidebar updates immediately
      queryClient.setQueryData(authKeys.me, user);
    },
  });
}