import { SESSION_COOKIE } from "./constants";

/** Reads the `exp` claim (ms since epoch) from a JWT without verifying it. */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiry(token);
  return exp !== null && exp <= Date.now();
}

/**
 * proxy.ts runs on the server and cannot read localStorage, so we mirror "a session exists"
 * into a cookie. It holds a flag, NOT the token — the token is only sent to the API.
 */
export function writeSessionCookie(token: string, persistent: boolean): void {
  if (typeof document === "undefined") return;
  const parts = [`${SESSION_COOKIE}=1`, "path=/", "SameSite=Lax"];
  const exp = getTokenExpiry(token);
  if (persistent && exp) parts.push(`expires=${new Date(exp).toUTCString()}`);
  if (window.location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
