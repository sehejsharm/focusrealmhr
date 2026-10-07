import { cookies } from "next/headers";
import { error, json } from "@/lib/onboarding/api.server";
import { ADMIN_COOKIE, checkPasscode, issueAdminSession } from "@/lib/onboarding/security.server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { passcode?: string } | null;
  const passcode = body?.passcode;

  if (typeof passcode !== "string" || !checkPasscode(passcode)) {
    return error("Incorrect passcode.", 401);
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE, issueAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });

  return json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return json({ ok: true });
}
