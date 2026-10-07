import { json } from "@/lib/onboarding/api.server";
import { getCandidateByToken } from "@/lib/onboarding/store.server";
import { toCandidateView } from "@/lib/onboarding/view";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const candidate = await getCandidateByToken(token);
  if (!candidate) return json({ error: "This onboarding link is not valid." }, 404);

  return json(toCandidateView(candidate));
}
