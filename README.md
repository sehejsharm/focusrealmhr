# Focus Realm Onboarding

Focus Realm HR: the internal flow that takes a selected intern from offer to
first day, plus the founders' console behind it and the offboarding
certificates at the end of a term.

Next.js App Router, Tailwind v4, Supabase for records and Cloudflare R2 for uploaded files. Every surface lives under
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
/hr/admin                       Founders' console (passcode, asked on every visit)
/hr/admin/[id]                  One candidate: documents and decisions
/hr/offboarding/[code]          End-of-term certificate and letters (PDF)
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

## End-of-internship documents

In the last ten days of a term the console drafts three documents from the
record. Nothing is issued until a founder approves it — each one separately —
and a founder can decide not to issue one.

| Document | What it is |
|---|---|
| **Certificate of internship completion** | The framed certificate, A4 landscape |
| **Internship completion letter** | On the letterhead: "This is to certify that…", the role, the dates and the length of the internship, and who to call or email to verify it or for a background check |
| **Letter of recommendation** | On the letterhead, in formal wording, with the founder's own paragraph if they write one |

- **The letterhead** is the founders' own (`content/onboarding/brand/focus-realm-letterhead.docx`):
  logo, name, tagline, web, email and phone in the header, the Jaipur address
  in the footer. `lib/onboarding/letterhead.ts` holds its details and colours.
- **PDF only.** Every document downloads as an A4 PDF — founders from the
  record, the intern from their offboarding page. There is no editable copy.
- **Security watermark.** Behind the text on every page: the logo, large and
  faint, and "FOCUS REALM · ORIGINAL · *reference number*" repeated on the
  diagonal. A page lifted from one document, or an edited one, shows the wrong
  reference underneath.
- **Verification.** Both letters print the signing founder's phone and email
  (the letterhead's by default; editable at approval) and the reference
  number; the certificate prints how to verify it.
- **The wording is frozen at approval.** Changing the layout re-renders every
  document already issued — so anyone leaving now gets the letterhead and the
  watermark — but never its approved text. A letter issued in the earlier
  wording says so on its record; withdraw it and approve it again to reissue
  it in the current formal wording. Someone already in their last ten days has
  the new completion letter waiting for approval on their record.

## Handling of personal data

- **Aadhaar uploads never enter `public/`.** They go to a private Cloudflare R2
  bucket (or, before R2 is set up, a private Supabase bucket) under a random filename, and stream only through an
  admin-authenticated route.
- **Only the last four digits of an Aadhaar are collected**, with a masked
  copy of the card. An organisation that checks an Aadhaar without
  authenticating it must not collect or store the number (Aadhaar Act
  s. 8A(4)), and UIDAI's direction is to keep only a masked copy. Records
  submitted before privacy notice `2026-10-12.1` still hold the full number;
  it shows in full only in the founders' console, and nowhere on the agreement.
- **Candidates declare they are 18 or older.** An agreement with a minor is
  void (Indian Contract Act s. 11); anyone under 18 is told to stop and speak
  to their point of contact.
- **The founders' console asks for the passcode on every visit** — each new
  tab or window, a reload, a tab the browser reopens or restores, or coming
  Back to it — even with a session still running elsewhere. A session lasts
  two hours at most and ends at **Lock** in the top bar, which locks every
  open console tab. If a session ends under a page that is open, the gate
  covers the page instead of replacing it, so nothing typed into it is lost.
- **Temporary mailbox passwords are encrypted at rest** (AES-256-GCM) and
  destroyed after a single view.
- **Assessment answer keys stay server-side** (`tests.server.ts`); submissions
  are scored on the server, so the 75% gate cannot be bypassed from the browser.
- The onboarding link is a bearer credential. Anyone holding it can act as that
  candidate, so treat it like a password.

Before real candidate data goes in, confirm: which Supabase region the project
sits in (Aadhaar data of Indian residents is worth keeping in `ap-south-1`, with
the Vercel functions in `bom1` next to it — the default is the US), who holds
the service-role key, how long records are kept, and legal review of the
agreement template.

## Privacy requests, erasure and breaches

The notice promises these, and nothing in the console does them for you yet —
they are the founders' job, by hand, from the Supabase dashboard.

**Requests** (see, correct, erase, withdraw consent) arrive at the privacy
email. Answer each within **30 days** — the notice promises it, and it is the
one-month limit the IT Act's data rules (SPDI Rules, r. 5(9)) set for a
grievance officer. Keep the email thread: it is the record that you did.

- *See*: send them their record from `onboarding_candidates` — never the
  `sealedPassword` fields — and say who it has been shared with (the
  Workspace, for name, role, start date, email and phone).
- *Correct*: edit the record's `details`, or send their details back from the
  console so they resubmit.
- *Withdraw consent*: onboarding stops. Remove them in the console, then erase
  as below unless a record has to be kept for the agreement already signed.

**Erasure.** The console shows each record's retention date ("keep until" or
"erase by"); nothing deletes on its own. When one passes — 90 days after an
internship that never began, three years after one that ended — or when a
person asks and nothing requires the record to be kept:

1. Delete the files named in the record's `details.aadhaarFile.storedAs` and
   `agreement.document.storedAs` from the R2 bucket **and** the Supabase
   `onboarding-aadhaar` bucket (older files may still be in either).
2. Delete the row from `onboarding_candidates`.
3. Offboard their Workspace account, if they still have one.

**If personal data leaks** — the service-role key, the R2 keys, the database, a bucket,
or an onboarding link sent to the wrong person:

1. Contain it. Rotate whatever leaked and redeploy:
   `SUPABASE_SERVICE_ROLE_KEY`, the R2 API token (`R2_ACCESS_KEY_ID` /
   `R2_SECRET_ACCESS_KEY` — roll it in Cloudflare), `ONBOARDING_ADMIN_PASSCODE`,
   `FOCUS_REALM_WORKSPACE_SECRET` or `FOCUS_REALM_CRM_SECRET` (on both sides —
   `HR_WEBHOOK_SECRET` on the other app), or `ONBOARDING_SECRET` —
   which signs every founder out, voids offboarding links and makes any
   uncollected mailbox or Workspace password unreadable, so reset those. A
   leaked onboarding link is its own credential: replace that record's
   `token`, in the column and in `record`, and send the new link.
2. Report it to CERT-In within **6 hours** of noticing — the CERT-In
   Directions of 28 April 2022 cover data breaches and leaks by any body
   corporate.
3. Tell every affected person, without delay, what happened, what it means for
   them and what they can do. From 13 May 2027, when the DPDP Rules' breach
   duty (r. 7) comes into force, also tell the Data Protection Board without
   delay, with a full report within **72 hours**.
4. Write down what happened, when, who was affected and what was done.

## Storage

Reached only from `lib/onboarding/store.server.ts` (R2 through
`lib/onboarding/r2.server.ts`):

| | |
|---|---|
| Supabase `public.onboarding_candidates` | One row per candidate — the record as `jsonb`, plus indexed `id`/`token`/`created_at` and a `version` for optimistic concurrency |
| Cloudflare R2 bucket (`R2_BUCKET`) | Uploaded files — Aadhaar copies and bespoke agreements — private. 10 GB free |
| Supabase `onboarding-aadhaar` bucket | Files from before the move to R2, and every file while R2 is not configured |

A file is stored under a random 32-hex name and that name is all a record
holds, so it can live in either bucket: reads try R2 first, then Supabase.

**Moving files to R2.**

1. In Cloudflare, create an R2 bucket with the location hint **Asia-Pacific**
   (it keeps Indian residents' Aadhaar copies in the region). Leave public
   access, the `r2.dev` URL and custom domains **off**.
2. Under R2 → Manage API tokens, create a token with **Object Read & Write**
   permission, limited to that bucket.
3. Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and
   `R2_BUCKET` to Vercel (Production) and redeploy. New uploads now go to R2.
4. Copy the older files across, from a machine with the Supabase and R2
   variables set:
   `npm run uploads:copy-to-r2 -- --dry-run`, then `npm run uploads:copy-to-r2`.
   It skips anything already copied, checks every file's size in R2, and
   deletes nothing.
5. Open a few Aadhaar copies and agreements in the console. Once they all open,
   empty the Supabase `onboarding-aadhaar` bucket to free its space.

The Supabase table and bucket have **RLS enabled with no policies at all**, so
the anon key cannot touch either one. The service-role key is the only way in, and it is used
server-side only. Concurrent writes retry against fresh state rather than
overwriting, so quick successive actions can't clobber each other.

## Focus Realm Workspace

Everyone added here also gets a login to the Focus Realm Workspace, the team's
employee app ([sehejsharm/employee-management](https://github.com/sehejsharm/employee-management)):
an **employee ID** such as `FR-0042` and a **temporary password**. They sign in
with those and choose their own password the first time.

The **employee ID is the only login**. Emails are not unique and never used to
sign in or to match people: several candidates may share one invite address
or mailbox, and each still gets their own record and their own employee ID.
The two systems are linked by the candidate's record id (`externalId` in the
Workspace). Where an email is shared, the founder's record page, the creation
confirmation and the candidate's login reveal list who else uses it.

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
| Their last day ends (midnight, Indian time) | Made a former employee: locked out and signed out on every device; history kept. Done by the nightly cron, or at once by **Sync everyone** |
| A founder removes them | Locked out and signed out on every device; history kept |
| A founder restores them | Can sign in again — unless their last day is already over |
| **Reset Workspace password**, on their record | A new temporary password, sealed the same way; signed out everywhere |
| **Sync everyone to the Workspace**, foot of `/hr/admin` | Every active person without a login gets one — including anyone whose last attempt failed; failures are listed with their error; safe to run again |

**Setup.** Set both, server-side only — never with a `NEXT_PUBLIC_` prefix:

| Variable | Value |
|---|---|
| `FOCUS_REALM_WORKSPACE_URL` | The Workspace's address, e.g. `https://workspace.focusrealm.com` |
| `FOCUS_REALM_WORKSPACE_SECRET` | The same value as `HR_WEBHOOK_SECRET` on the Workspace (`openssl rand -hex 32`) |
| `CRON_SECRET` | Any long random value (`openssl rand -hex 32`). Vercel sends it to the nightly cron in `vercel.json`, which calls `/api/cron/workspace-leavers` at 19:05 UTC (00:35 in India) |

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
logged: re-run the sync to give anyone who missed out a login. A removal or a
last day the Workspace has not confirmed is retried by every nightly run and
every sync until it is; the person's record shows whether it has been.

## Focus Realm Sales CRM

People in the **sales department, and only them,** also get a login to the Focus Realm Sales CRM
([sehejsharm/crm-focusrealm](https://github.com/sehejsharm/crm-focusrealm)),
with the **same employee ID** as their Workspace login. Nobody outside sales
gets one, and nobody outside sales has any data sent to it — never Marketing,
the Founder's Office or any other department. There is deliberately no
per-person override: being in a sales role is the only way in.

Who counts as sales: a role whose id, name or title says sales, business
development or BD (`isSalesRole` in `lib/onboarding/crm-sync.server.ts`; of the
built-in tracks only **Business Development** qualifies). The CRM checks
again against its own list (its Settings → HR console); if it skips someone
this console counts as sales, the sync reports it so the list can be fixed.

Same contract and pattern as the Workspace: `lib/onboarding/crm-sync.server.ts`
is the CRM's own client (`docs/hr-console/crm-sync.server.ts` there), copied
verbatim — replace it wholesale, never edit it. `lib/onboarding/crm.server.ts`
records what comes back; the temporary password is sealed and shown once,
exactly like the Workspace one.

| Happens here | In the CRM |
|---|---|
| A sales person is added | Login created after their Workspace login, with the same ID; temporary password sealed on their record |
| They submit their details / their mailbox is recorded | Name, email and phone updated |
| Their last day ends, or a founder removes them | Login switched off, signed out everywhere; history kept; open prospects flagged to founders for reassignment. Nightly cron and every sync until confirmed |
| A founder restores them | Can sign in again — unless their last day is over |
| **Reset CRM password**, on their record | New temporary password, shown once; signed out everywhere |
| **Sync everyone (Workspace & CRM)**, foot of `/hr/admin` | Every active sales person without a CRM login gets one; failures listed |

**Setup.** On the CRM set `HR_WEBHOOK_SECRET` (`openssl rand -hex 32`). Here,
server-side only:

| Variable | Value |
|---|---|
| `FOCUS_REALM_CRM_URL` | The CRM's address, e.g. `https://crm.focusrealm.com` |
| `FOCUS_REALM_CRM_SECRET` | The same value as `HR_WEBHOOK_SECRET` on the CRM |

With either unset, every CRM call is skipped and the console works as before.

**What it receives.** Name, role and title, department, start date, email
(the invitation address until a company mailbox exists), the Workspace
employee ID and — for people who consented under privacy notice `2026-10-16.1`
or later, the first to name the CRM — phone (`consentCoversCrm`). Never the
Aadhaar number or copy, the address, the parent's name, the agreement or
assessment results.

## One website

The Workspace, this console and the Sales CRM are one website at the
Workspace's address. Everyone signs in to the Workspace; its app switcher
takes founders to the HR console and founders and sales people to the CRM.
Each app keeps its own code, deployment and storage.

How this app takes part (`lib/onboarding/hub.server.ts`, `proxy.ts`):

- The Workspace routes `/hr`, `/hr/*`, `/hr-static/*`, `/api/onboarding/*` to
  this app's production URL, adding the header `x-focusrealm-hub:
  <FOCUS_REALM_HUB_SECRET>`. Invitation and offboarding links keep their
  `/hr/...` paths, now on the website's address.
- Opening the console from the switcher goes to the Workspace's `/launch/hr`,
  which (founders only) redirects to `/hr/admin?launch=<ticket>`. The ticket is
  `base64url(JSON) + "." + base64url(HMAC-SHA256(secret, first part))`, payload
  `{ v: 1, app: "hr", sub: "FR-0001", name, role: "FOUNDER", iat, exp }`,
  at most 120 seconds. The console swaps it for its own two-hour session and
  removes it from the address. The passcode still works as a fallback.
- Any request to this app's own Vercel address without that header is
  redirected (308) to the same path on the website. The nightly cron is exempt.
- Scripts and styles are served under `/hr-static` so they never collide with
  the Workspace's.

**Order matters.** Deploy the Workspace's routing first and check
`<website>/hr` loads. Only then set `FOCUS_REALM_HUB_URL` and
`FOCUS_REALM_HUB_SECRET` here and redeploy — set too early, the redirect sends
people to a website that doesn't serve `/hr` yet. To undo, remove the two
variables and redeploy.

## Deploying to Vercel

1. Import the repo — Next.js is detected, no build settings needed.
2. Set the variables from `.env.example` in **Settings → Environment
   Variables** — the first four are required, the Workspace, cron and R2 ones
   optional. `SUPABASE_SERVICE_ROLE_KEY` must be server-side only: do not
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
