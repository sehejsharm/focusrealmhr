import { clientIp, error, json } from "@/lib/onboarding/api.server";
import { getCandidateByToken, updateCandidate } from "@/lib/onboarding/store.server";
import { buildContract, contractToText } from "@/lib/onboarding/contract";
import { agreementReady, currentStage, requiredTestIds } from "@/lib/onboarding/stage";
import { toCandidateView } from "@/lib/onboarding/view";
import { assessmentsPassedPhrase } from "@/lib/onboarding/content";
import type { Signature } from "@/lib/onboarding/types";

/** The agreement, generated from the candidate's own submitted details. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  // Added directly as an existing employee: there is no onboarding to do.
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);

  const stage = currentStage(candidate);
  if (stage === "details" || stage === "learning" || stage === "tests") {
    return error(`Your agreement is prepared once ${assessmentsPassedPhrase(requiredTestIds(candidate).length)}.`, 409);
  }

  if (!agreementReady(candidate)) {
    return error(
      "Your agreement is being prepared for your role. Your point of contact will let you know as soon as it is ready.",
      409,
    );
  }

  const plan = candidate.agreement ?? { kind: "standard" as const };

  /*
   * Two shapes of agreement: the generated one, and a document the founders
   * uploaded for a role the template does not cover. The portal renders
   * whichever this candidate was invited under.
   */
  if (plan.kind === "bespoke" && plan.document) {
    return json({
      kind: "bespoke",
      document: {
        originalName: plan.document.originalName,
        mimeType: plan.document.mimeType,
        bytes: plan.document.bytes,
      },
      signature: candidate.signature ?? null,
      companySignature: candidate.companySignature ?? null,
    });
  }

  const contract = buildContract(candidate);
  if (!contract) return error("Could not prepare the agreement.", 500);

  return json({
    kind: "standard",
    contract,
    signature: candidate.signature ?? null,
    companySignature: candidate.companySignature ?? null,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const candidate = await getCandidateByToken(token);
  if (!candidate) return error("This onboarding link is not valid.", 404);
  // Added directly as an existing employee: there is no onboarding to do.
  if (candidate.existing) return error("There are no onboarding steps on this record.", 409);
  if (candidate.signature) return error("This agreement is already signed.", 409);
  if (currentStage(candidate) !== "contract") {
    return error(`Your agreement can be signed once ${assessmentsPassedPhrase(requiredTestIds(candidate).length)}.`, 409);
  }
  if (!agreementReady(candidate)) {
    return error("The agreement for your role is not ready to sign yet.", 409);
  }

  const body = (await request.json().catch(() => null)) as
    | { typedName?: string; affirmed?: boolean; electronicSignatureConsent?: boolean }
    | null;

  const typedName = body?.typedName?.trim();
  if (!typedName) return error("Type your full name to sign.");
  if (body?.affirmed !== true) return error("Confirm the declaration before signing.");
  if (body?.electronicSignatureConsent !== true) {
    return error(
      "Confirm that you have read the agreement and consent to signing it electronically.",
    );
  }

  // Guards against signing with someone else's name, ignoring case and spacing.
  const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalise(typedName) !== normalise(candidate.details!.fullName)) {
    return error("The typed name must match the full name you submitted.");
  }

  const plan = candidate.agreement ?? { kind: "standard" as const };

  /*
   * What the candidate agreed to is frozen at signing: the full text for a
   * generated agreement, and an unambiguous reference to the file for an
   * uploaded one, since its bytes stay in private storage.
   */
  let snapshot: string;
  if (plan.kind === "bespoke" && plan.document) {
    snapshot = [
      "Signed against the agreement document supplied for this role.",
      `File: ${plan.document.originalName}`,
      `Type: ${plan.document.mimeType}`,
      `Size: ${plan.document.bytes} bytes`,
      `Stored reference: ${plan.document.storedAs}`,
      plan.uploadedAt ? `Uploaded: ${plan.uploadedAt}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } else {
    const contract = buildContract(candidate);
    if (!contract) return error("Could not prepare the agreement.", 500);
    snapshot = contractToText(contract);
  }

  const signature: Signature = {
    typedName,
    affirmed: true,
    electronicSignatureConsent: true,
    signedAt: new Date().toISOString(),
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
    contractSnapshot: snapshot,
  };

  const updated = await updateCandidate(candidate.id, (c) => ({
    ...c,
    signature,
    // A fresh signature clears any earlier rejection note.
    contractRejection: undefined,
  }));
  if (!updated) return error("Could not record your signature.", 500);

  return json(toCandidateView(updated));
}
