import { cookies } from "next/headers";
import { error, json } from "@/lib/onboarding/api.server";
import { ADMIN_COOKIE, issueAdminSession } from "@/lib/onboarding/security.server";
import { hubUrl, verifyLaunch } from "@/lib/onboarding/hub.server";

/** Whether the console sits behind the single website, so the gate can offer Workspace sign-in. */
export async function GET() {
  return json({ hub: hubUrl() !== null });
}

/**
 * Exchanges a Workspace launch ticket for a founders' console session — the
 * Workspace sign-in instead of the passcode. Only founders get tickets.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ticket?: string } | null;
  const launch = verifyLaunch(body?.ticket);
  if (!launch) return error("This sign-in link has expired. Open the HR console from the Workspace again.", 401);

  const store = await cookies();
  store.set(ADMIN_COOKIE, issueAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return json({ ok: true, name: launch.name });
}
