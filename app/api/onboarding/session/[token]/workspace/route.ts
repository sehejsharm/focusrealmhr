import { error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken } from "@/lib/onboarding/store.server";
import { currentStage, stageIndex } from "@/lib/onboarding/stage";
import { claimWorkspacePassword, workspaceLoginUrl } from "@/lib/onboarding/workspace.server";

/**
 * The candidate's Focus Realm Workspace login, from the last step of
 * onboarding on. Reveals the temporary password exactly once, then destroys
 * the stored copy — the mailbox rule. A second call returns the login without
 * a password.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  if (stageIndex(currentStage(candidate)) < stageIndex("email")) {
    return error("Your Workspace login opens once your agreement has been verified.", 409);
  }
  if (!candidate.workspace) return error("Your Workspace login has not been created yet.", 409);

  const password = candidate.workspace.sealedPassword
    ? await claimWorkspacePassword(candidate.id)
    : null;

  return json({
    loginId: candidate.workspace.loginId,
    password,
    alreadyViewed: !password,
    loginUrl: workspaceLoginUrl(),
  });
}
