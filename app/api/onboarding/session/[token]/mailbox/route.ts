import { error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken, updateCandidate } from "@/lib/onboarding/store.server";
import { unseal } from "@/lib/onboarding/security.server";
import { toCandidateView } from "@/lib/onboarding/view";
import { MAIL_SETTINGS, OUTLOOK_STEPS } from "@/lib/onboarding/content";

/** The candidate asks for a company mailbox, once their contract is verified. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  if (!candidate.contractVerifiedAt) {
    return error("Your agreement is still being verified.", 409);
  }
  if (candidate.emailRequestedAt) return error("You have already requested a mailbox.", 409);

  const updated = await updateCandidate(candidate.id, (c) => ({
    ...c,
    emailRequestedAt: new Date().toISOString(),
  }));
  if (!updated) return error("Could not record your request.", 500);

  return json(toCandidateView(updated));
}

/**
 * Reveals the temporary password exactly once, then destroys the stored copy.
 * A second call returns the settings without a password.
 */
export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);

  const mailbox = candidate.mailbox;
  if (!mailbox) return error("Your mailbox has not been created yet.", 409);

  const password = mailbox.sealedPassword ? unseal(mailbox.sealedPassword) : null;

  if (mailbox.sealedPassword) {
    await updateCandidate(candidate.id, (c) => ({
      ...c,
      mailbox: c.mailbox
        ? {
            address: c.mailbox.address,
            provisionedAt: c.mailbox.provisionedAt,
            viewedAt: new Date().toISOString(),
          }
        : undefined,
    }));
  }

  return json({
    address: mailbox.address,
    password,
    alreadyViewed: !mailbox.sealedPassword,
    settings: MAIL_SETTINGS,
    outlookSteps: OUTLOOK_STEPS,
  });
}
