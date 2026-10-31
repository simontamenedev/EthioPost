import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, SESSION_COOKIE } from "./src/lib/auth/constants";

/**
 * Server-side redirect for first paint:
 *   guest        → anything except /login  ⇒  /login?next=<path>
 *   signed in    → /login                  ⇒  /
 * The cookie only says "a session exists"; the API still verifies the Bearer token on every call.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = pathname === LOGIN_PATH;

  if (!hasSession && !isLogin) {
    const url = new URL(LOGIN_PATH, request.url);
    if (pathname !== HOME_PATH) url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && isLogin) {
    return NextResponse.redirect(new URL(HOME_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  // skip Next internals, API routes and anything with a file extension (/brand/*.svg, favicon…)
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
