# Focus Realm Onboarding

Focus Realm HR: the internal flow that takes a selected intern from offer to
first day, plus the founders' console behind it and the offboarding
certificates at the end of a term.

Next.js App Router, Tailwind v4, Supabase for storage. Every surface lives under
`/hr`; the bare root forwards there. Nothing here is indexed.

## The flow

| | Candidate | Founders |
|---|---|---|
| 1 | Submits full name, parent's name, address, Aadhaar number and a copy of the card | |
| 2 | Reads both handbooks, watches both video briefings | |
| 3 | Passes both assessments — **75% each, judged separately**, unlimited retakes | |
| 4 | Reviews the agreement, generated from their own details, and e-signs it | |
| 5 | | Verifies the signature, or sends it back with a note |
| 6 | Requests a mailbox | Creates it on SpaceMail, records the address and password |
| 7 | Collects the password **once**, with IMAP/SMTP settings and Outlook steps | |

Stages are derived from the record itself (`lib/onboarding/stage.ts`), so a
candidate can never be in a state their data does not support. Each step is
enforced server-side, not just hidden in the UI.

## Routes

```
/hr                             Landing — paste your invite link
/hr/[token]                     The candidate's whole onboarding
/hr/admin                       Founders' console (passcode)
/hr/admin/[id]                  One candidate: documents and decisions
/hr/offboarding/[code]          End-of-term certificates
/hr/privacy                     How candidate data is handled
/api/onboarding/…               Everything above talks to these
```

Invitation links sent out before the module was renamed point at
`/onboarding/...`; `next.config.ts` forwards every one of those to its `/hr`
equivalent, so old links keep working.

## Setup

```bash
cp .env.example .env.local     # then fill in all four values
npm run dev
```

Open `/hr/admin`, create a candidate, and send them the generated link.

## Handling of personal data

- **Aadhaar uploads never enter `public/`.** They go to a private Supabase
  bucket under a random filename, and stream only through an
  admin-authenticated route.
- **The Aadhaar number is masked everywhere but the founders' console** —
  including in the candidate's own view and on the rendered agreement.
- **Temporary mailbox passwords are encrypted at rest** (AES-256-GCM) and
  destroyed after a single view.
- **Assessment answer keys stay server-side** (`tests.server.ts`); submissions
  are scored on the server, so the 75% gate cannot be bypassed from the browser.
- The onboarding link is a bearer credential. Anyone holding it can act as that
  candidate, so treat it like a password.

Before real candidate data goes in, confirm: which Supabase region the project
sits in (Aadhaar data of Indian residents is worth keeping in `ap-south-1`),
who holds the service-role key, how long records are kept, and legal review of
the agreement template.

## Storage

Supabase, reached only from `lib/onboarding/store.server.ts`:

| | |
|---|---|
| `public.onboarding_candidates` | One row per candidate — the record as `jsonb`, plus indexed `id`/`token`/`created_at` and a `version` for optimistic concurrency |
| `onboarding-aadhaar` bucket | The uploaded Aadhaar copies, private |

Both have **RLS enabled with no policies at all**, so the anon key cannot touch
either one. The service-role key is the only way in, and it is used
server-side only. Concurrent writes retry against fresh state rather than
overwriting, so quick successive actions can't clobber each other.

## Deploying to Vercel

1. Import the repo — Next.js is detected, no build settings needed.
2. Set all four variables from `.env.example` in **Settings → Environment
   Variables**. `SUPABASE_SERVICE_ROLE_KEY` must be server-side only: do not
   give it a `NEXT_PUBLIC_` prefix.
3. Deploy.

`next.config.ts` carries an `outputFileTracingIncludes` entry for the handbook
route — the PDFs are read from a path built at runtime, which the file tracer
cannot follow on its own. Without it the handbooks 500 in production.

## Content

Handbooks and the agreement template live in `content/onboarding/` and are the
source of truth. Assessment questions are in `lib/onboarding/tests.server.ts`,
twelve per handbook, each traceable to a section. Video links and SpaceMail
settings are in `lib/onboarding/content.ts`.
