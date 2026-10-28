import { NextResponse, type NextRequest } from "next/server";

/**
 * One website, not several links. Once FOCUS_REALM_HUB_URL is set, this app is
 * reached only through the Workspace's address, which routes /hr, the
 * onboarding API and /hr-static here with the header below. Anyone opening
 * this app's own Vercel address is sent to the same page on the website.
 *
 * Left alone: the nightly cron (Vercel calls this app directly) and the
 * header the Workspace adds, which carries FOCUS_REALM_HUB_SECRET.
 */
export function proxy(request: NextRequest) {
  const hub = process.env.FOCUS_REALM_HUB_URL?.replace(/\/$/, "");
  const secret = process.env.FOCUS_REALM_HUB_SECRET;
  if (!hub || !secret) return NextResponse.next();
  if (request.headers.get("x-focusrealm-hub") === secret) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/cron/")) return NextResponse.next();

  return NextResponse.redirect(`${hub}${pathname}${search}`, 308);
}

export const config = {
  // Not our own build assets fetched by the website (they come with the header anyway).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
