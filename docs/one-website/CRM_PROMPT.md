# Prompt: Sales CRM side of the single Focus Realm website

Open a Claude Code session on **sehejsharm/crm-focusrealm** and paste
everything below the line.

---

You are working in the Focus Realm Sales CRM (React + Vite SPA in apps/web,
Express API in apps/api, one Vercel project; see docs/DEPLOY_VERCEL.md and
vercel.json). Read README.md first and follow existing patterns.

GOAL
The CRM now appears on the single Focus Realm website at /crm — the Workspace's
address routes /crm/* to this app, stripping the /crm prefix
(/crm/leads → <this app>/leads, /crm/api/x → <this app>/api/x,
/crm/assets/x → <this app>/assets/x) and adding the request header
`x-focusrealm-hub: <FOCUS_REALM_HUB_SECRET>`. People sign in to the Workspace
and reach the CRM from its app switcher; no separate CRM login for them.
Only founders and the SALES department may use the CRM — nobody from
Marketing, the Founder's Office or any other department.

ENVIRONMENT (server-only):
  FOCUS_REALM_HUB_SECRET  shared with the Workspace and the HR console
  FOCUS_REALM_HUB_URL     the website's address, e.g. https://employee-management.vercel.app
With either unset, the CRM behaves exactly as today (own address, own login).

1. BASE PATH — build the web app to live under /crm when VITE_BASE_PATH=/crm/
   is set at build time (default "/"): Vite `base`, React Router `basename`,
   every API call (apps/web/src/lib/api.ts uses `/api${url}`) and every
   absolute link/asset/service-worker path must go through the base. The
   server keeps serving at its root (the Workspace strips /crm), so the
   Express routes and vercel.json rewrites do not change.

2. SSO — GET /api/auth/hub?launch=<ticket> (reached as /crm/api/auth/hub…;
   also accept the SPA route /sso?launch=… by having that page call it):
   - Ticket = base64url(JSON payload) + "." + base64url(HMAC-SHA256(
     FOCUS_REALM_HUB_SECRET, <that first part, the base64url text>)).
     Payload {"v":1,"app":"crm","sub":"FR-0042","name":…,"role":…,"iat":s,"exp":s}.
     Reject unless v=1, app="crm", signature matches (timingSafeEqual),
     exp > now, iat <= now+30, exp-iat <= 120.
   - Find the CRM user by employee_code = sub, status active. If none:
     403 "You don't have a Sales CRM login" (do NOT create one — logins
     come only from the HR console sync, sales department only).
   - Set the normal session cookie (setSessionCookie) and redirect to the
     user's portal under the base path (e.g. /crm/).
   Add tests for valid, wrong app, expired, bad signature and unknown user.

3. ONE ADDRESS — when FOCUS_REALM_HUB_URL and FOCUS_REALM_HUB_SECRET are set,
   any request to this app WITHOUT the header `x-focusrealm-hub` equal to the
   secret is redirected 308 to FOCUS_REALM_HUB_URL + "/crm" + path + query —
   EXCEPT /api/cron/* (Vercel Cron calls this app directly), telephony and
   recording webhooks, and /api/integrations/hr/events (the HR console calls
   it server-to-server). Compare the header with timingSafeEqual.

4. SWITCHER — in the CRM's top bar, links "Workspace" (href "/") and, for
   founders only, "HR console" (href "/launch/hr"), next to the current
   "Sales CRM". Plain <a> (different apps). Only shown when the base path is
   /crm/. On the login page, when the base path is /crm/, show "Sign in with
   the Workspace" (href "/launch/crm") above the existing form.

VERIFY
- npm run lint, typecheck, tests and the Vercel build pass, with and without
  VITE_BASE_PATH=/crm/.
- Without the env vars, the CRM works exactly as before.

Don't push to the production branch directly; open a pull request with a
summary of what changed.
