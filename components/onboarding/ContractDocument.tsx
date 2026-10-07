"use client";

import type { Contract } from "@/lib/onboarding/contract";
import { formatLongDate } from "@/lib/onboarding/contract";
import type { CompanySignature, Signature } from "@/lib/onboarding/types";

/**
 * The agreement rendered on paper stock rather than the navy shell — this is
 * the one screen that has to read as a legal document, and it prints cleanly.
 */
export default function ContractDocument({
  contract,
  signature,
  companySignature,
}: {
  contract: Contract;
  signature?: Signature | null;
  companySignature?: CompanySignature | null;
}) {
  return (
    <article
      className="rounded-2xl px-5 py-8 sm:px-10 sm:py-12"
      style={{ backgroundColor: "#fbfaf7", color: "#1a1a1a" }}
    >
      <header className="mb-8 border-b border-stone-300 pb-6 text-center">
        <p className="text-[11px] font-bold tracking-[0.22em] text-stone-500 uppercase">
          {contract.subtitle}
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{contract.title}</h1>
        <p className="mt-3 text-xs text-stone-500">
          Draft template — recommended for legal review before signature.
        </p>
      </header>

      <p className="text-sm leading-relaxed">{contract.preamble}</p>

      <div className="mt-6 space-y-4">
        {contract.parties.map((party, index) => (
          <div key={index}>
            {party.label && (
              <p className="mb-1 text-xs font-bold tracking-[0.16em] text-stone-500 uppercase">
                {party.label}
              </p>
            )}
            <p className="text-sm leading-relaxed text-pretty">{party.body}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs font-bold tracking-[0.16em] text-stone-500 uppercase">
        Recitals
      </h2>
      <div className="space-y-3">
        {contract.recitals.map((line, index) => (
          <p key={index} className="text-sm leading-relaxed text-pretty">
            {line}
          </p>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-xs font-bold tracking-[0.16em] text-stone-500 uppercase">
        Terms and Conditions
      </h2>
      <ol className="space-y-4">
        {contract.clauses.map((clause) => (
          <li key={clause.heading}>
            <p className="text-sm leading-relaxed text-pretty">
              <span className="font-bold">{clause.heading}.</span> {clause.body}
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-sm leading-relaxed">{contract.execution}</p>

      <div className="mt-8 grid gap-8 border-t border-stone-300 pt-8 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-stone-500 uppercase">
            For and on behalf of
          </p>
          <p className="mt-1 text-sm font-bold">FocusRealm (to be incorporated)</p>
          <dl className="mt-4 space-y-3 text-sm">
            <SignatureLine
              label="Signature"
              value={companySignature?.typedName}
              script={Boolean(companySignature)}
            />
            <SignatureLine label="Name" value={companySignature?.typedName} />
            <SignatureLine
              label="Designation"
              value={companySignature?.designation ?? "Authorized Signatory"}
            />
            <SignatureLine
              label="Date"
              value={
                companySignature ? formatLongDate(new Date(companySignature.signedAt)) : undefined
              }
            />
          </dl>
        </div>

        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-stone-500 uppercase">The Intern</p>
          <p className="mt-1 text-sm font-bold">{contract.fields.fullName}</p>
          <dl className="mt-4 space-y-3 text-sm">
            <SignatureLine
              label="Signature"
              value={signature ? signature.typedName : undefined}
              script={Boolean(signature)}
            />
            <SignatureLine label="Name" value={contract.fields.fullName} />
            <SignatureLine
              label="Aadhaar Card No."
              value={`XXXX XXXX ${contract.fields.aadhaarNumber.slice(-4)}`}
            />
            <SignatureLine
              label="Date"
              value={signature ? formatLongDate(new Date(signature.signedAt)) : undefined}
            />
          </dl>
        </div>
      </div>

      {(signature || companySignature) && (
        <div className="mt-8 space-y-2 rounded-lg bg-stone-100 px-4 py-3 text-[11px] leading-relaxed text-stone-600">
          {signature && (
            <p>
              Signed electronically by {signature.typedName} (Intern) on{" "}
              {new Date(signature.signedAt).toLocaleString("en-IN")}
              {signature.ip ? ` from ${signature.ip}` : ""}, affirming they had read and accepted
              this agreement in full.
            </p>
          )}
          {companySignature && (
            <p>
              Countersigned electronically by {companySignature.typedName},{" "}
              {companySignature.designation}, for FocusRealm on{" "}
              {new Date(companySignature.signedAt).toLocaleString("en-IN")}
              {companySignature.ip ? ` from ${companySignature.ip}` : ""}.
            </p>
          )}
          <p>
            Aadhaar number is masked in this view; the full number is held on the signed record.
          </p>
        </div>
      )}
    </article>
  );
}

function SignatureLine({
  label,
  value,
  script,
}: {
  label: string;
  value?: string;
  script?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-stone-600">{label}:</dt>
      <dd
        className={`min-w-0 flex-1 border-b border-stone-400 pb-0.5 ${
          script ? "text-base italic" : ""
        }`}
      >
        {value ?? " "}
      </dd>
    </div>
  );
}
