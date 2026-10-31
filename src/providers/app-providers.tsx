"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { ApiError } from "../lib/api/client";
import { useAuthStore } from "../lib/auth/auth-store";

export function AppProviders({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // never retry 4xx (bad input, 401, 403, 404) — only flaky network / 5xx
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
          },
        },
      }),
  );

  // Load the persisted session once on the client (store uses skipHydration).
  useEffect(() => {
    void useAuthStore.persist.rehydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
