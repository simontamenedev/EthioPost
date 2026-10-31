import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { User } from "@/lib/api/types";
import { clearSessionCookie, isTokenExpired, writeSessionCookie } from "./token";

type AuthState = {
  token: string | null;
  user: User | null;
  /** "Keep me signed in": true → localStorage + persistent cookie, false → sessionStorage + session cookie */
  remember: boolean;
  hasHydrated: boolean;
  login: (token: string, remember: boolean) => void;
  setUser: (user: User) => void;
  logout: () => void;
};

const STORAGE_KEY = "ethiopost-auth";
let rememberFlag = false; // read by the storage adapter below

const isBrowser = () => typeof window !== "undefined";

const splitStorage: StateStorage = {
  getItem: (name) => (isBrowser() ? (localStorage.getItem(name) ?? sessionStorage.getItem(name)) : null),
  setItem: (name, value) => {
    if (!isBrowser()) return;
    const [keep, drop] = rememberFlag ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    keep.setItem(name, value);
    drop.removeItem(name);
  },
  removeItem: (name) => {
    if (!isBrowser()) return;
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      remember: false,
      hasHydrated: false,
      login: (token, remember) => {
        rememberFlag = remember;
        writeSessionCookie(token, remember);
        set({ token, remember, user: null });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        clearSessionCookie();
        set({ token: null, user: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => splitStorage),
      partialize: ({ token, user, remember }) => ({ token, user, remember }),
      // Hydration is triggered manually from <AppProviders/> so SSR and the first client render match.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          rememberFlag = state.remember;
          if (isTokenExpired(state.token)) state.logout();
          else writeSessionCookie(state.token, state.remember);
        }
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
