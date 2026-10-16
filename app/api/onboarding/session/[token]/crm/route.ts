import { error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken } from "@/lib/onboarding/store.server";
import { currentStage, stageIndex } from "@/lib/onboarding/stage";
import { claimCrmPassword, crmLoginUrl } from "@/lib/onboarding/crm.server";

/**
 * A sales person's Focus Realm Sales CRM login, from the last step of
 * onboarding on — the Workspace rule. Reveals the temporary password exactly
 * once, then destroys the stored copy; a second call returns the login only.
 * They sign in with the employee ID, never their email.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  if (stageIndex(currentStage(candidate)) < stageIndex("email")) {
    return error("Your Sales CRM login opens once your agreement has been verified.", 409);
  }
  if (!candidate.crm || candidate.crm.offboarded) return error("You do not have a Sales CRM login.", 409);

  const password = candidate.crm.sealedPassword ? await claimCrmPassword(candidate.id) : null;

  return json({
    loginId: candidate.crm.loginId,
    password,
    alreadyViewed: !password,
    loginUrl: crmLoginUrl(),
    email: candidate.mailbox?.address ?? candidate.invitedEmail,
    sharedEmailWith: [],
  });
}
