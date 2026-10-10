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

## Focus Realm Workspace

Everyone added here also gets a login to the Focus Realm Workspace, the team's
employee app ([sehejsharm/employee-management](https://github.com/sehejsharm/employee-management)):
an **employee ID** such as `FR-0042` and a **temporary password**. They sign in
with those and choose their own password the first time.

The two apps talk through one signed endpoint on the Workspace; its
`docs/HR_CONSOLE_INTEGRATION.md` has the contract. The client,
`lib/onboarding/workspace-sync.server.ts`, is copied verbatim from that
repository — replace it wholesale rather than editing it.
`lib/onboarding/workspace.server.ts` records what comes back.

| Happens here | In the Workspace |
|---|---|
| A candidate or existing employee is added | Account created; the temporary password is sealed on their record |
| They submit their details | Full name and phone updated |
| Their company mailbox is recorded | Their sign-in email becomes the mailbox |
| A founder removes them | Locked out and signed out on every device; history kept |
| A founder restores them | Can sign in again |
| **Reset Workspace password**, on their record | A new temporary password, sealed the same way; signed out everywhere |
| **Sync everyone to the Workspace**, foot of `/hr/admin` | Everyone without a login gets one; safe to run again |

**Setup.** Set both, server-side only — never with a `NEXT_PUBLIC_` prefix:

| Variable | Value |
|---|---|
| `FOCUS_REALM_WORKSPACE_URL` | The Workspace's address, e.g. `https://workspace.focusrealm.com` |
| `FOCUS_REALM_WORKSPACE_SECRET` | The same value as `HR_WEBHOOK_SECRET` on the Workspace (`openssl rand -hex 32`) |

With either unset, every Workspace call is skipped silently and the console
works exactly as before. Once both are set, press **Sync everyone to the
Workspace** so the people already here get a login too.

**What it receives.** Name, role, start date, email (the invitation address
until a company mailbox exists) and phone — never the Aadhaar number or copy,
the address or the parent's name. The phone number goes only for people who
consented under privacy notice `2026-10-10.1` or later, the first to cover the
Workspace; anyone who consented earlier keeps theirs out
(`consentCoversWorkspace` in `lib/onboarding/compliance.ts`, applied in
`lib/onboarding/workspace.server.ts`).

**Credentials.** The temporary password is handled like the mailbox one:
encrypted at rest with `ONBOARDING_SECRET`, and shown **once** — to a founder
on the person's record, or to the person themselves on the last step of
onboarding (and in their portal after it), whoever opens it first — then
destroyed. It never appears in the candidate list, in logs, or in any response
but that one-time reveal. Hand it over in person, never by email or chat. If
it is lost, **Reset Workspace password** issues a new one.

A Workspace call never holds up an HR action. If the Workspace is down, the
person is created, updated or removed here all the same, and the error is
logged: re-run the sync to give anyone who missed out a login, and check the
Workspace's admin → HR console screen after removing someone while it was
down, since that removal will not have locked them out there.

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
