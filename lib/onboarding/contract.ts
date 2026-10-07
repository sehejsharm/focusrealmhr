import type { Candidate } from "./types";
import { DEFAULT_TERM_MONTHS, trackOf } from "./types";

/**
 * The internship agreement, generated from the candidate's own details.
 *
 * Mirrors content/onboarding/contract/founders-office-internship-agreement.docx
 * clause for clause — that file stays in the repo as the source of truth. Every
 * blank in the template is a field here. Legal review before first use.
 */

export interface ContractFields {
  fullName: string;
  parentName: string;
  aadhaarNumber: string;
  address: string;
  roleTitle: string;
  startDate: Date;
  endDate: Date;
  effectiveDate: Date;
}

export interface ContractClause {
  heading: string;
  body: string;
}

export interface Contract {
  title: string;
  subtitle: string;
  preamble: string;
  parties: { label: string; body: string }[];
  recitals: string[];
  clauses: ContractClause[];
  execution: string;
  fields: ContractFields;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(day: number): string {
  if (day > 3 && day < 21) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function formatLongDate(date: Date): string {
  return `${ordinal(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "three (3)" — the agreement spells the term out, as contracts do. */
const NUMBER_WORD = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one",
  "twenty-two", "twenty-three", "twenty-four",
];

export function spellMonths(months: number): string {
  const word = NUMBER_WORD[months] ?? String(months);
  return `${word} (${months})`;
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function formatAadhaar(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function buildContract(candidate: Candidate): Contract | null {
  if (!candidate.details) return null;

  const role = trackOf(candidate);
  const termMonths = candidate.termMonths || DEFAULT_TERM_MONTHS;
  const start = new Date(candidate.startDate);
  const fields: ContractFields = {
    fullName: candidate.details.fullName,
    parentName: candidate.details.parentName,
    aadhaarNumber: candidate.details.aadhaarNumber,
    address: candidate.details.address,
    roleTitle: role.roleTitle,
    startDate: start,
    endDate: addMonths(start, termMonths),
    // The agreement takes effect when the candidate signs it.
    effectiveDate: candidate.signature ? new Date(candidate.signature.signedAt) : new Date(),
  };

  const duties = role.duties;

  return {
    title: "Internship Agreement",
    subtitle: `FocusRealm · ${role.label} Internship — Unpaid Internship · ${termMonths}-Month Term`,
    preamble: `This Internship Agreement ("Agreement") is made and entered into on this ${formatLongDate(fields.effectiveDate)} (the "Effective Date"),`,
    parties: [
      {
        label: "BETWEEN",
        body: 'FocusRealm (to be incorporated), having its principal place of business at Pune, Maharashtra, India, represented herein by its authorized signatory (hereinafter referred to as the "Company", which expression shall, unless repugnant to the context or meaning thereof, be deemed to include its successors, and permitted assigns following incorporation);',
      },
      {
        label: "AND",
        body: `${fields.fullName}, son/daughter of ${fields.parentName}, holding Aadhaar Card No. ${formatAadhaar(fields.aadhaarNumber)}, and residing at ${fields.address} (hereinafter referred to as the "Intern").`,
      },
      {
        label: "",
        body: 'The Company and the Intern are hereinafter individually referred to as a "Party" and collectively as the "Parties".',
      },
    ],
    recitals: [
      "WHEREAS, the Company is engaged in building a B2B software platform for standard operating procedures and staff training, and requires assistance with strategic, research, and operational work through its Founder's Office;",
      `WHEREAS, the Intern has expressed a genuine interest in undertaking a period of unpaid, practical, skill-based training with the Company in the capacity of "${fields.roleTitle}", for educational and professional development purposes;`,
      "WHEREAS, the Parties wish to record the terms and conditions governing this internship engagement;",
      "NOW, THEREFORE, in consideration of the mutual covenants contained herein, the Parties agree as follows:",
    ],
    clauses: [
      {
        heading: "1. Term and Duration",
        body: `The internship shall commence on ${formatLongDate(fields.startDate)} and shall continue for a period of ${spellMonths(termMonths)} months, ending on or around ${formatLongDate(fields.endDate)} (the "Internship Period"), unless terminated earlier in accordance with Clause 9. Any extension of the Internship Period shall be by mutual written consent of both Parties.`,
      },
      {
        heading: "2. Role and Responsibilities",
        body: `The Intern shall serve in the role of ${fields.roleTitle} and shall perform duties consistent with that role, including but not limited to ${duties}, as more particularly described in the corresponding job description issued by the Company, and as may reasonably be assigned or varied by the Company from time to time.`,
      },
      {
        heading: "3. Nature of Engagement",
        body: "This Agreement records an internship undertaken for training, learning, and skill-development purposes only. Nothing in this Agreement shall be construed as creating an employer-employee relationship, a contract of employment, or a partnership or agency relationship between the Parties. The Intern shall not be entitled to any statutory or contractual employment benefits, including but not limited to provident fund, gratuity, bonus, leave encashment, or insurance, by virtue of this engagement.",
      },
      {
        heading: "4. Compensation",
        body: "This is an unpaid internship. No salary, wage, stipend, or other monetary compensation of any kind is payable by the Company to the Intern for services rendered during the Internship Period, except any specific expense reimbursement that the Parties may separately agree to in writing in advance.",
      },
      {
        heading: "5. Working Hours and Location",
        body: "The internship is remote-first in nature. The Intern shall be available for the reasonable hours required to perform the responsibilities under Clause 2, including periodic real-time virtual meetings with the founding team, which may occasionally fall outside standard working hours.",
      },
      {
        heading: "6. Confidentiality",
        body: "The Intern acknowledges that, in the course of the internship, they may have access to confidential, proprietary, strategic, financial, and business information belonging to the Company. The Intern agrees not to disclose, use, or exploit any such information, either during the Internship Period or at any time thereafter, other than for the purpose of performing their duties under this Agreement, without the Company's prior written consent.",
      },
      {
        heading: "7. Intellectual Property",
        body: "All work product, research, documents, ideas, and materials created, developed, or contributed to by the Intern in the course of the internship shall be the sole and exclusive property of the Company. The Intern hereby assigns, and agrees to assign, all rights, title, and interest in such work product to the Company.",
      },
      {
        heading: "8. Standards of Conduct",
        body: "The Intern shall perform their duties diligently, professionally, and in good faith, shall comply with the Company's reasonable instructions and policies, and shall not make any commitments or representations on behalf of the Company without prior authorization.",
      },
      {
        heading: "9. Termination",
        body: "Either Party may terminate this Agreement by providing seven (7) days' prior written notice to the other Party. Notwithstanding the foregoing, the Company may terminate this Agreement with immediate effect and without notice in the event of any breach of this Agreement, misconduct, or unsatisfactory performance by the Intern.",
      },
      {
        heading: "10. Certificate of Completion",
        body: "Upon satisfactory completion of the Internship Period, the Company shall issue the Intern a certificate of completion and, at the Company's discretion, a letter of recommendation reflecting the Intern's contribution.",
      },
      {
        heading: "11. Non-Solicitation",
        body: "For a period of six (6) months following the end of the Internship Period, the Intern shall not, directly or indirectly, solicit or encourage any employee, contractor, client, or partner of the Company to terminate or diminish their relationship with the Company.",
      },
      {
        heading: "12. Indemnity and Limitation of Liability",
        body: "The Intern undertakes this internship voluntarily and shall exercise reasonable care in the performance of their duties. Neither Party shall be liable to the other for any indirect, incidental, or consequential loss arising out of this Agreement, save in cases of gross negligence, wilful misconduct, or breach of Clause 6 or Clause 7.",
      },
      {
        heading: "13. Governing Law and Jurisdiction",
        body: "This Agreement shall be governed by and construed in accordance with the laws of India. The courts at Pune, Maharashtra shall have exclusive jurisdiction over any dispute arising out of or in connection with this Agreement.",
      },
      {
        heading: "14. Entire Agreement; Amendment",
        body: "This Agreement constitutes the entire understanding between the Parties with respect to the internship and supersedes all prior discussions or understandings, whether oral or written. No amendment or modification shall be effective unless made in writing and signed by both Parties.",
      },
      {
        heading: "15. Severability",
        body: "If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
      },
    ],
    execution:
      "IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.",
    fields,
  };
}

/** Flattened text, frozen into the signature record at the moment of signing. */
export function contractToText(contract: Contract): string {
  return [
    contract.title,
    contract.subtitle,
    "",
    contract.preamble,
    "",
    ...contract.parties.map((p) => (p.label ? `${p.label}\n${p.body}` : p.body)),
    "",
    "RECITALS",
    ...contract.recitals,
    "",
    "TERMS AND CONDITIONS",
    ...contract.clauses.map((c) => `${c.heading}. ${c.body}`),
    "",
    contract.execution,
  ].join("\n");
}
