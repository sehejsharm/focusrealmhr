/**
 * Assessment banks. SERVER ONLY — this module carries the answer keys, so it
 * must never be imported from a client component. Use `toClientTest` to build
 * the shape the browser is allowed to see.
 *
 * Every question is answerable from the handbook it is paired with. Twelve
 * questions at a 75% pass mark means nine correct answers to clear a test.
 */

export interface TestQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
  answerId: string;
  /** Shown only after a failed attempt, to point the candidate back. */
  reference: string;
}

export interface TestDefinition {
  id: string;
  title: string;
  subtitle: string;
  /** The handbook this test covers. */
  resourceId: string;
  /** Percent needed to pass, judged per test rather than across both. */
  passMark: number;
  questions: TestQuestion[];
}

export interface ClientTest {
  id: string;
  title: string;
  subtitle: string;
  resourceId: string;
  passMark: number;
  questions: { id: string; prompt: string; options: { id: string; label: string }[] }[];
}

export const TESTS: TestDefinition[] = [
  {
    id: "test-focus-realm",
    title: "Focus Realm assessment",
    subtitle: "Company, products, and the language rules",
    resourceId: "handbook-focus-realm",
    passMark: 75,
    questions: [
      {
        id: "fr-1",
        prompt: 'What is "Mise"?',
        options: [
          { id: "a", label: "A retired internal prototype codename — never used as a company or product name" },
          { id: "b", label: "The current name of the hospitality product" },
          { id: "c", label: "Our parent company" },
          { id: "d", label: "The name of the Staff role interface" },
        ],
        answerId: "a",
        reference: "Section 06 — Naming rules",
      },
      {
        id: "fr-2",
        prompt: "How should Focus Realm Hospitality be positioned to a prospect?",
        options: [
          { id: "a", label: "As a hospitality-specific LMS" },
          { id: "b", label: "As a Service Execution Platform — never as an LMS, at any level of positioning" },
          { id: "c", label: "As a training platform for hotel staff" },
          { id: "d", label: "As an LMS for hotels with a compliance module" },
        ],
        answerId: "b",
        reference: "Section 06 — Naming rules",
      },
      {
        id: "fr-3",
        prompt: "What is the core product thesis behind Focus Realm Hospitality?",
        options: [
          { id: "a", label: "Deliver training content to staff more efficiently than a binder" },
          { id: "b", label: "Digitise SOP documents so they are searchable on mobile" },
          { id: "c", label: "The SOP lives inside the timed task; completing it generates photo and supervisor evidence, which becomes an audit-ready service record" },
          { id: "d", label: "Track staff attendance and shift rosters against a standard" },
        ],
        answerId: "c",
        reference: "Section 06 — The core product thesis",
      },
      {
        id: "fr-4",
        prompt: "In the six-pain narrative, which pain is the inevitable conclusion if nothing changes?",
        options: [
          { id: "a", label: "Attrition Bleed" },
          { id: "b", label: "Ghost SOP" },
          { id: "c", label: "Star Rating Ceiling" },
          { id: "d", label: "Audit Ambush" },
        ],
        answerId: "d",
        reference: "Section 06 — The six-pain narrative",
      },
      {
        id: "fr-5",
        prompt: 'Strategic Minimalism is our answer to which problem?',
        options: [
          { id: "a", label: '"Feature Dumping" — generic LMS platforms shipping huge feature sets, up to 80% of which go unused' },
          { id: "b", label: "Hotels refusing to pay for software" },
          { id: "c", label: "Slow implementation timelines across the industry" },
          { id: "d", label: "A shortage of trained hospitality staff" },
        ],
        answerId: "a",
        reference: "Section 03 — Our Philosophy",
      },
      {
        id: "fr-6",
        prompt: "What is the rule on naming Legion and TDC?",
        options: [
          { id: "a", label: "Name them only in proposals, not in decks" },
          { id: "b", label: "They are internal-only — never named to a client, prospect, or press" },
          { id: "c", label: "Name them freely; they are our public partners" },
          { id: "d", label: "Name them only once a deal has closed" },
        ],
        answerId: "b",
        reference: "Section 11 — Partner Ecosystem (Confidential)",
      },
      {
        id: "fr-7",
        prompt: "Which vocabulary should be avoided when describing the hospitality product's category?",
        options: [
          { id: "a", label: "standards, evidence, readiness" },
          { id: "b", label: "timed tasks, service record, operating briefs" },
          { id: "c", label: "course, module, learner, training platform, LMS" },
          { id: "d", label: "audit, compliance, sign-off" },
        ],
        answerId: "c",
        reference: "Section 06 — Language discipline",
      },
      {
        id: "fr-8",
        prompt: "What are the three roles in the hospitality product's architecture?",
        options: [
          { id: "a", label: "Employee, Department Head, HR Admin" },
          { id: "b", label: "Staff, Manager, Author" },
          { id: "c", label: "Trainee, Trainer, Auditor" },
          { id: "d", label: "Attendant, Supervisor, General Manager" },
        ],
        answerId: "b",
        reference: "Section 06 — Three-role architecture",
      },
      {
        id: "fr-9",
        prompt: "Which consultative sales framework do we sell with?",
        options: [
          { id: "a", label: "SPIN — Situation, Problem, Implication, Need-Payoff" },
          { id: "b", label: "BANT — Budget, Authority, Need, Timeline" },
          { id: "c", label: "AIDA — Attention, Interest, Desire, Action" },
          { id: "d", label: "MEDDIC" },
        ],
        answerId: "a",
        reference: "Section 10 — How We Sell",
      },
      {
        id: "fr-10",
        prompt: "Does the no-LMS rule apply to Focus Realm Education?",
        options: [
          { id: "a", label: "Yes — neither product may ever be described as LMS-adjacent" },
          { id: "b", label: "No — Education is legitimately LMS-adjacent, and that framing is fine there" },
          { id: "c", label: "Only when speaking to school boards" },
          { id: "d", label: "Only in written proposals" },
        ],
        answerId: "b",
        reference: "Sections 03 and 07 — Two verticals, two vocabularies",
      },
      {
        id: "fr-11",
        prompt: "What is the current position on PMS integration for the hospitality product?",
        options: [
          { id: "a", label: "PMS integration ships in the first release" },
          { id: "b", label: "PMS integration is promised to clients during the sales cycle" },
          { id: "c", label: "No PMS integration at this stage — a deliberate foot-in-door strategy to reduce sales friction" },
          { id: "d", label: "PMS integration is handled by Legion after a deal closes" },
        ],
        answerId: "c",
        reference: "Section 06 — Locked product decisions",
      },
      {
        id: "fr-12",
        prompt: "What is the rule on statistics and financial figures in client-facing work?",
        options: [
          { id: "a", label: "Estimate figures where a real one is not to hand, so the document reads complete" },
          { id: "b", label: "Use real, defensible statistics; never fabricate figures, and financial specifics stay as placeholders until Sehej or Ali confirm them" },
          { id: "c", label: "Quote the pitch deck's market figures as current" },
          { id: "d", label: "Include commission percentages so the client can see the full picture" },
        ],
        answerId: "b",
        reference: "Section 13 — Twelve rules to internalise",
      },
    ],
  },
  {
    id: "test-recharga",
    title: "Recharga Chargine assessment",
    subtitle: "Company, RADAX, and the business model",
    resourceId: "handbook-recharga",
    passMark: 75,
    questions: [
      {
        id: "rc-1",
        prompt: 'What does "RADAX" stand for?',
        options: [
          { id: "a", label: "RADial + AXial" },
          { id: "b", label: "Rapid Direct Axis" },
          { id: "c", label: "Radial Alternating Xchange" },
          { id: "d", label: "Renewable Advanced Drive Axis" },
        ],
        answerId: "a",
        reference: "Section 02 — What RADAX means",
      },
      {
        id: "rc-2",
        prompt: "What kind of company is Recharga Chargine?",
        options: [
          { id: "a", label: "A wind turbine manufacturer" },
          { id: "b", label: "An independent power producer selling electricity" },
          { id: "c", label: "A B2B deep-tech IP licensing company — we own the architecture, our partners own the factory" },
          { id: "d", label: "A contract manufacturer of generator components" },
        ],
        answerId: "c",
        reference: "Section 02 — Our identity in one line",
      },
      {
        id: "rc-3",
        prompt: "Where does the technology stand today, and what is the next major milestone?",
        options: [
          { id: "a", label: "TRL 4–5 today — component-level validation complete; TRL 7, prototype demonstrated, is next" },
          { id: "b", label: "TRL 7 today; commercial production is next" },
          { id: "c", label: "TRL 9 — fully commercialised" },
          { id: "d", label: "TRL 1–2 — basic principles observed" },
        ],
        answerId: "a",
        reference: "Section 06 — Where the technology stands",
      },
      {
        id: "rc-4",
        prompt: "What is our Indian patent application number?",
        options: [
          { id: "a", label: "202311070882" },
          { id: "b", label: "202411070882" },
          { id: "c", label: "202410708822" },
          { id: "d", label: "202411700882" },
        ],
        answerId: "b",
        reference: "Section 03 — Intellectual Property",
      },
      {
        id: "rc-5",
        prompt: "What is the compromise at the heart of every wind turbine that RADAX is designed to eliminate?",
        options: [
          { id: "a", label: "Onshore siting versus offshore siting" },
          { id: "b", label: "Blade length versus tower height" },
          { id: "c", label: "A gearbox that is a guaranteed point of mechanical failure, versus an oversized direct-drive generator of 55–65 tonnes" },
          { id: "d", label: "Rare-earth magnets versus copper windings" },
        ],
        answerId: "c",
        reference: "Section 05 — The Problem We're Solving",
      },
      {
        id: "rc-6",
        prompt: "What is our primary revenue model?",
        options: [
          { id: "a", label: "Selling generator units directly at INR 40,000 each" },
          { id: "b", label: "An annual, recurring technology licensing fee charged to wind turbine OEMs" },
          { id: "c", label: "Maintenance and support contracts" },
          { id: "d", label: "Government grants and subsidies" },
        ],
        answerId: "b",
        reference: "Section 07 — The Business Model",
      },
      {
        id: "rc-7",
        prompt: 'What does ground rule one, "Be Accurate or Be Quiet", require?',
        options: [
          { id: "a", label: "Never represent an unvalidated figure as confirmed — say so, or ask before repeating it externally" },
          { id: "b", label: "Keep internal meetings short" },
          { id: "c", label: "Only founders speak to external parties" },
          { id: "d", label: "Write every update down before speaking it" },
        ],
        answerId: "a",
        reference: "Section 14 — Six Ground Rules",
      },
      {
        id: "rc-8",
        prompt: "What is our beachhead market?",
        options: [
          { id: "a", label: "Hybrid heavy-duty vehicles" },
          { id: "b", label: "Run-of-river hydroelectric" },
          { id: "c", label: "Onshore wind, in the 3–6 MW turbine class" },
          { id: "d", label: "Industrial motors" },
        ],
        answerId: "c",
        reference: "Sections 02 and 08 — Staged market expansion",
      },
      {
        id: "rc-9",
        prompt: "What is an FTO study, and what is its status?",
        options: [
          { id: "a", label: "Freedom-to-Operate — completed before the patent was filed" },
          { id: "b", label: "Freedom-to-Operate — confirms RADAX can be commercialised without infringing existing patents; still to be commissioned, and critical before any licensing agreement is finalised" },
          { id: "c", label: "Full Technical Overview — an internal engineering document already circulated" },
          { id: "d", label: "Field Testing Operation — scheduled alongside the prototype build" },
        ],
        answerId: "b",
        reference: "Sections 03 and 10 — Milestones",
      },
      {
        id: "rc-10",
        prompt: "What is our most advanced commercial relationship to date?",
        options: [
          { id: "a", label: "A signed multi-year licence with a global wind OEM" },
          { id: "b", label: "A signed Letter of Interest with a manufacturing partner" },
          { id: "c", label: "A closed paid Proof-of-Concept with an Indian IPP" },
          { id: "d", label: "A government supply contract" },
        ],
        answerId: "b",
        reference: "Sections 09 and 10 — Traction",
      },
      {
        id: "rc-11",
        prompt: "Who leads engineering design and simulation work?",
        options: [
          { id: "a", label: "Sehej Sharma, Founder & CEO" },
          { id: "b", label: "The Chief Engineer, already in post" },
          { id: "c", label: "Ali Electricwala, Founder & CPO" },
          { id: "d", label: "An external engineering consultancy" },
        ],
        answerId: "c",
        reference: "Section 04 — Meet the Founders",
      },
      {
        id: "rc-12",
        prompt: "How should the confidentiality of technical detail be treated?",
        options: [
          { id: "a", label: "Architecture details and simulation results do not leave the company without explicit clearance" },
          { id: "b", label: "Anything already in the onboarding guide can be shared publicly" },
          { id: "c", label: "Technical detail can be shared with prospective partners under a verbal understanding" },
          { id: "d", label: "Only the patent number is confidential" },
        ],
        answerId: "a",
        reference: "Sections 06 and 14 — IP Is Sacred",
      },
    ],
  },
];

export function getTest(id: string): TestDefinition | undefined {
  return TESTS.find((t) => t.id === id);
}

/** Strips the answer key before anything reaches the browser. */
export function toClientTest(test: TestDefinition): ClientTest {
  return {
    id: test.id,
    title: test.title,
    subtitle: test.subtitle,
    resourceId: test.resourceId,
    passMark: test.passMark,
    questions: test.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  };
}

export interface ScoredResult {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
  /** Handbook sections to revisit, for the questions they got wrong. */
  missedReferences: string[];
}

export function scoreTest(
  test: TestDefinition,
  answers: Record<string, string>,
): ScoredResult {
  const wrong = test.questions.filter((q) => answers[q.id] !== q.answerId);
  const correct = test.questions.length - wrong.length;
  const score = Math.round((correct / test.questions.length) * 100);

  return {
    correct,
    total: test.questions.length,
    score,
    passed: score >= test.passMark,
    missedReferences: [...new Set(wrong.map((q) => q.reference))],
  };
}
