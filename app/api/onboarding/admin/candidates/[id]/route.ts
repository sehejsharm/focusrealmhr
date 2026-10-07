import { clientIp, error, isAdmin, json } from "@/lib/onboarding/api.server";
import { getCandidate, updateCandidate } from "@/lib/onboarding/store.server";
import { buildContract } from "@/lib/onboarding/contract";
import { companiesOf, currentStage, retentionOf } from "@/lib/onboarding/stage";
import { formatAadhaar, formatLongDate } from "@/lib/onboarding/contract";
import { generatePassword, offboardingCode, seal } from "@/lib/onboarding/security.server";
import {
  CERTIFICATE_LABEL,
  activeCertificate,
  certificateWindow,
  draftCertificate,
  isCertificateKind,
  isDeclined,
} from "@/lib/onboarding/certificates";
import { offboardingLinkAvailable, offboardingState } from "@/lib/onboarding/offboarding";
import { randomBytes } from "node:crypto";

/** `FR-IC-2026-7K3QX9` — completion; `FR-LR-…` — recommendation letter. */
function newSerial(kind: "completion" | "recommendation"): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const code = Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
  return `FR-${kind === "completion" ? "IC" : "LR"}-${new Date().getUTCFullYear()}-${code}`;
}

/** Full record, including the Aadhaar number. Admin session required. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) return error("Not found.", 404);

  const { mailbox, ...rest } = candidate;
  const offboarding = offboardingState(candidate);

  return json({
    ...rest,
    certificateWindow: certificateWindow(candidate),
    offboardingState: offboarding,
    // Shown from two days before the last day, ready to send.
    offboardingLink: offboardingLinkAvailable(offboarding)
      ? `/hr/offboarding/${offboardingCode(candidate.id)}`
      : null,
    stage: currentStage(candidate),
    companies: companiesOf(candidate),
    retention: retentionOf(candidate),
    aadhaarFormatted: candidate.details ? formatAadhaar(candidate.details.aadhaarNumber) : null,
    contract: buildContract(candidate),
    // The sealed password is never returned — it is the candidate's to view.
    mailbox: mailbox
      ? {
          address: mailbox.address,
          provisionedAt: mailbox.provisionedAt,
          viewedAt: mailbox.viewedAt ?? null,
          collected: !mailbox.sealedPassword,
        }
      : null,
  });
}

/**
 * The three decisions the founders make: verify a signed agreement, send it
 * back, or provision the mailbox.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) return error("Not authorised.", 401);

  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) return error("Not found.", 404);

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    note?: string;
    address?: string;
    password?: string;
    typedName?: string;
    designation?: string;
    leftOn?: string;
    reason?: string;
    kind?: string;
    highlights?: string;
    contactEmail?: string;
  } | null;

  // A removed intern's record is frozen: restore them before acting on it.
  if (candidate.removal && body?.action !== "restore") {
    return error("This person has been removed. Restore them before making changes.", 409);
  }

  switch (body?.action) {
    /*
     * Removal ends the engagement without deleting anything. The record, the
     * signed agreement and the Aadhaar copy are all kept, because the privacy
     * notice commits to holding them for the term plus three years (or to
     * erasing them within 90 days if the internship never began) — deleting
     * here would break that. What changes is that the onboarding link stops
     * working and the intern leaves the active list.
     */
    case "remove": {
      const leftOn = body.leftOn;
      if (!leftOn || Number.isNaN(Date.parse(leftOn))) {
        return error("Enter the date they left.");
      }
      if (new Date(leftOn).getTime() > Date.now() + 24 * 3600_000) {
        return error("The date they left cannot be in the future.");
      }
      const reason = body.reason?.trim() || undefined;
      if (reason && reason.length > 500) return error("Keep the reason under 500 characters.");

      const now = new Date().toISOString();
      const updated = await updateCandidate(id, (c) => ({
        ...c,
        removal: { at: now, leftOn: new Date(leftOn).toISOString(), reason, ip: clientIp(request) },
        // The store keys token lookups off this, which is what shuts the link.
        archivedAt: now,
      }));
      return json({ ok: true, retention: updated ? retentionOf(updated) : null });
    }

    case "restore": {
      if (!candidate.removal) return error("This person is not removed.", 409);

      await updateCandidate(id, (c) => ({ ...c, removal: undefined, archivedAt: undefined }));
      return json({ ok: true });
    }

    // Focus Realm's side of the agreement. Countersigning is also what marks it
    // verified — a countersigned agreement is what "verified" means. Records
    // verified before countersigning existed can still be signed here, which
    // fills in their company block without disturbing their stage.
    case "countersign": {
      if (!candidate.signature) return error("The intern has not signed yet.", 409);
      if (candidate.companySignature) return error("This is already countersigned.", 409);

      const typedName = body.typedName?.trim();
      const designation = body.designation?.trim() || "Authorized Signatory";
      if (!typedName) return error("Type the signatory's full name.");

      const updated = await updateCandidate(id, (c) => ({
        ...c,
        companySignature: {
          typedName,
          designation,
          signedAt: new Date().toISOString(),
          ip: clientIp(request),
        },
        contractVerifiedAt: c.contractVerifiedAt ?? new Date().toISOString(),
        contractRejection: undefined,
      }));
      return json({ ok: true, stage: updated ? currentStage(updated) : null });
    }

    case "reject": {
      const note = body.note?.trim();
      if (!note) return error("Say what needs correcting.");
      if (!candidate.signature) return error("Nothing has been signed yet.", 409);
      if (candidate.companySignature) {
        return error("This agreement is countersigned and cannot be sent back.", 409);
      }

      const updated = await updateCandidate(id, (c) => ({
        ...c,
        signature: undefined,
        contractVerifiedAt: undefined,
        contractRejection: { note, at: new Date().toISOString() },
      }));
      return json({ ok: true, stage: updated ? currentStage(updated) : null });
    }

    case "provision": {
      const address = body.address?.trim();
      if (!address) return error("Enter the mailbox address you created.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return error("That is not a valid address.");
      if (!candidate.contractVerifiedAt) return error("Verify the agreement first.", 409);
      if (candidate.mailbox) return error("A mailbox is already recorded.", 409);

      // Either mirror the password set in SpaceMail, or hand back a generated
      // one for the operator to set there.
      const password = body.password?.trim() || generatePassword();

      const updated = await updateCandidate(id, (c) => ({
        ...c,
        mailbox: {
          address,
          provisionedAt: new Date().toISOString(),
          sealedPassword: seal(password),
        },
      }));

      return json({
        ok: true,
        address,
        // Shown once in the console so the operator can set it in SpaceMail.
        password,
        stage: updated ? currentStage(updated) : null,
      });
    }

    /*
     * Approves one end-of-internship document for this intern. Each document
     * is approved on its own, and only inside the last days of the term. The
     * founder's typed name is the signature; the full text is frozen here, so
     * the PDF can never drift from what was approved.
     */
    case "issue-certificate": {
      const kind = body.kind;
      if (!isCertificateKind(kind)) return error("Choose which document to approve.");

      const timing = certificateWindow(candidate);
      if (timing.status === "not-eligible") return error(timing.reason, 409);
      if (timing.status === "not-yet") {
        return error(
          `This can be prepared from ${formatLongDate(new Date(timing.opensOn))}, in the last ten days of the term.`,
          409,
        );
      }
      if (activeCertificate(candidate, kind)) {
        return error(`The ${CERTIFICATE_LABEL[kind].toLowerCase()} is already issued. Withdraw it first to reissue.`, 409);
      }
      if (isDeclined(candidate, kind)) {
        return error(`This intern is marked as not receiving a ${CERTIFICATE_LABEL[kind].toLowerCase()}. Undo that first.`, 409);
      }

      const typedName = body.typedName?.trim();
      const designation = body.designation?.trim();
      if (!typedName) return error("Type the approving founder's full name.");
      if (!designation) return error("Enter the approving founder's designation.");
      if (typedName.length > 120 || designation.length > 120) return error("That name or designation is too long.");

      const highlights = kind === "recommendation" ? body.highlights?.trim() || undefined : undefined;
      if (highlights && highlights.length > 1200) {
        return error("Keep the founder's note under 1,200 characters.");
      }
      const contactEmail = kind === "recommendation" ? body.contactEmail?.trim() || undefined : undefined;
      if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
        return error("That contact email is not valid.");
      }

      const issuedAt = new Date().toISOString();
      const serial = newSerial(kind);

      const updated = await updateCandidate(id, (c) => {
        // Re-checked against fresh state, so two founders approving at once
        // cannot issue the same document twice.
        if (activeCertificate(c, kind)) return c;
        const text = draftCertificate(c, kind, {
          signatory: { name: typedName, designation, contactEmail },
          highlights,
          issuedOn: issuedAt,
          serial,
        });
        return {
          ...c,
          certificates: [
            ...(c.certificates ?? []),
            {
              kind,
              serial,
              issuedAt,
              approvedBy: { typedName, designation, ip: clientIp(request) },
              highlights,
              text,
            },
          ],
        };
      });

      const issued = updated ? activeCertificate(updated, kind) : null;
      if (!issued || issued.serial !== serial) {
        return error("Someone else issued this document a moment ago. Refresh to see it.", 409);
      }
      return json({ ok: true, serial });
    }

    // Takes an issued document back — a mistake in it, say. It stays on the
    // record as withdrawn and can be reissued; the intern can no longer download it.
    case "withdraw-certificate": {
      const kind = body.kind;
      if (!isCertificateKind(kind)) return error("Choose which document to withdraw.");
      const current = activeCertificate(candidate, kind);
      if (!current) return error("There is nothing issued to withdraw.", 409);

      const reason = body.reason?.trim();
      if (!reason) return error("Say why it is being withdrawn.");
      if (reason.length > 500) return error("Keep the reason under 500 characters.");

      await updateCandidate(id, (c) => ({
        ...c,
        certificates: (c.certificates ?? []).map((cert) =>
          cert.serial === current.serial && !cert.withdrawn
            ? { ...cert, withdrawn: { at: new Date().toISOString(), reason, ip: clientIp(request) } }
            : cert,
        ),
      }));
      return json({ ok: true });
    }

    // A founder's decision that this intern will not receive this document.
    // It then never appears on their offboarding page.
    case "decline-certificate": {
      const kind = body.kind;
      if (!isCertificateKind(kind)) return error("Choose which document.");
      if (activeCertificate(candidate, kind)) {
        return error("This document is already issued. Withdraw it first.", 409);
      }
      await updateCandidate(id, (c) => ({
        ...c,
        declinedCertificates: [...new Set([...(c.declinedCertificates ?? []), kind])],
      }));
      return json({ ok: true });
    }

    case "undo-decline": {
      const kind = body.kind;
      if (!isCertificateKind(kind)) return error("Choose which document.");
      await updateCandidate(id, (c) => ({
        ...c,
        declinedCertificates: (c.declinedCertificates ?? []).filter((k) => k !== kind),
      }));
      return json({ ok: true });
    }

    default:
      return error("Unknown action.");
  }
}
