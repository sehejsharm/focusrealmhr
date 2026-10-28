# Prompt: Workspace side of the single Focus Realm website

Open a Claude Code session on **sehejsharm/employee-management** (production
branch `claude/friendly-heisenberg-mgxoro`) and paste everything below the line.

---

You are working in the Focus Realm Workspace (Next.js 16, App Router, Prisma,
deployed on Vercel). Read AGENTS.md and the Next.js docs in
node_modules/next/dist/docs/ first (proxy.md, multi-zones.md) — this Next.js
has breaking changes. Follow existing patterns (src/proxy.ts, src/lib/auth/*).

GOAL
Make the Workspace's address the ONE website for Focus Realm. Everyone signs
in here. The HR console (separate Vercel app, sehejsharm/focusrealmhr) is
served on this same address under /hr, and the Sales CRM (separate Vercel app,
sehejsharm/crm-focusrealm) under /crm. A switcher at the top of the Workspace
moves people between the apps they may use. Each app keeps its own code,
deployment and storage. Do not merge their code into this repo.

Who sees what in the switcher:
- Everyone: Workspace.
- Founders (role FOUNDER): Workspace, HR console, Sales CRM.
- Sales department only (department name matches sales, business
  development, business-development, bd or inside sales — case-insensitive,
  whole word): Workspace, Sales CRM.
- Nobody else sees HR console or Sales CRM. Marketing, Founder's Office and
  every other department never see the CRM.

ENVIRONMENT (server-only, never NEXT_PUBLIC_):
  FOCUS_REALM_HUB_SECRET   shared with the HR console and the CRM
  HR_CONSOLE_ORIGIN        e.g. https://focusrealmhr.vercel.app (no trailing slash)
  CRM_ORIGIN               the CRM's own Vercel production URL (no trailing slash)
With HR_CONSOLE_ORIGIN unset, no /hr routing and no HR switcher entry; same
for CRM_ORIGIN and /crm. With FOCUS_REALM_HUB_SECRET unset, nothing changes.

1. ROUTING — in src/proxy.ts, before the session gate and BEFORE any CSP is
   applied, route these paths with NextResponse.rewrite to the other app,
   adding the request header `x-focusrealm-hub: <FOCUS_REALM_HUB_SECRET>`
   (NextResponse.rewrite(url, { request: { headers } })):
     HR console (HR_CONSOLE_ORIGIN): /hr, /hr/*, /hr-static/*, /api/onboarding/*
       → same path and query on HR_CONSOLE_ORIGIN.
     CRM (CRM_ORIGIN): /crm, /crm/* → strip the /crm prefix:
       /crm → CRM_ORIGIN/ ; /crm/x/y?q → CRM_ORIGIN/x/y?q (this includes
       /crm/api/* → CRM_ORIGIN/api/* and /crm/assets/* → CRM_ORIGIN/assets/*).
   These paths are PUBLIC for the Workspace's own gate (candidates open
   /hr/<token> invitation links without a Workspace account; the HR console
   and CRM check access themselves). Do NOT add the Workspace's
   Content-Security-Policy or nonce to these responses — the other apps send
   their own headers, and the Workspace's nonce policy would block their
   scripts. Make sure the proxy matcher includes these paths.

2. LAUNCH ROUTES — GET /launch/hr and GET /launch/crm (route handlers):
   - Require a signed-in, active user (use the existing data access layer);
     otherwise redirect to /login?next=/launch/hr (or crm).
   - /launch/hr: FOUNDER only, else 403 page "The HR console is for founders."
   - /launch/crm: FOUNDER or sales department (rule above), else 403.
   - Build a ticket: payload {"v":1,"app":"hr"|"crm","sub":<employeeCode>,
     "name":<full name>,"role":<role>,"iat":<now s>,"exp":<now+60 s>},
     ticket = base64url(JSON.stringify(payload)) + "." +
              base64url(HMAC-SHA256(FOCUS_REALM_HUB_SECRET, <that first part>))
     (HMAC over the base64url text of the payload, not the raw JSON).
   - Redirect (302, Cache-Control: no-store) to
     /hr/admin?launch=<ticket>  or  /crm/sso?launch=<ticket>.
   The HR console already verifies exactly this format
   (focusrealmhr lib/onboarding/hub.server.ts). Add a unit test that signs a
   ticket and checks the format byte-for-byte against that description.

3. APP SWITCHER — in the main app header/top bar (desktop and mobile), a
   compact switcher: "Workspace" (current), "HR console" (href /launch/hr),
   "Sales CRM" (href /launch/crm), showing only the entries the rule above
   allows and only when that app's ORIGIN is set. Plain <a> tags, not <Link>
   (different apps; full page loads). Match the existing design system, light
   and dark, keyboard accessible.

4. Keep everything else working: login, sessions, existing routes, the HR
   events endpoint /api/integrations/hr/events (NOT under /api/onboarding, so
   it is not proxied), crons.

VERIFY
- npm run lint, typecheck, tests and build pass.
- With the env vars unset the app behaves exactly as before.
- Locally with HR_CONSOLE_ORIGIN pointing at a running HR console: /hr loads
  the HR landing page with its styles (/hr-static assets 200); /launch/hr as a
  founder lands on /hr/admin and the console opens without the passcode; as an
  intern returns 403; /launch/crm as a Marketing person returns 403.

Don't push to the production branch directly; open a pull request with a
summary of what changed.
