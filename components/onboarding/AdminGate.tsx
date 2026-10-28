"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Lock } from "lucide-react";
import { Button, Card, Field, Notice, SectionTitle, ThemeToggle, Wordmark, inputClass, inputStyle } from "./ui";

/**
 * The founders' console asks for the passcode every time it is opened: a new
 * tab or window, a reload, a reopened or restored tab, or coming Back to it.
 *
 * Whether this tab is unlocked lives only in this page's JavaScript memory.
 * Moving between console pages with <Link> keeps it; anything that starts the
 * page afresh does not — nothing the browser saves or restores can carry it.
 *
 * The session itself is an httpOnly cookie, shared by every tab. So a tab
 * that has not been unlocked throws that cookie away before it shows the gate
 * — otherwise the gate would only hide data the API still hands out.
 */

/**
 * - locked: nothing behind the gate (a fresh page, or after Lock).
 * - open: the console is showing.
 * - expired: the session ended under an open page (two hours passed, or
 *   another tab started a fresh visit). The page stays mounted, hidden, so
 *   nothing typed into it is lost; the passcode brings it back.
 */
type GateStatus = "locked" | "open" | "expired";

const LOCK_CHANNEL = "fr-admin-lock";

let status: GateStatus = "locked";
const listeners = new Set<() => void>();

function getStatus(): GateStatus {
  return status;
}

function setStatus(next: GateStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function endSession(): Promise<unknown> {
  return fetch("/api/onboarding/admin/session", { method: "DELETE" }).catch(() => {});
}

/** Ends the session, after any ending already under way — a sign-in waits for all of them. */
function endSessionAfter(pending: Promise<unknown>): Promise<unknown> {
  return Promise.all([pending, endSession()]);
}

/**
 * fetch for the console's own API. A 401 means the session is gone, so the
 * gate comes back over the page — whichever request found out first.
 */
export async function adminFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401 && status === "open") setStatus("expired");
  return response;
}

interface AdminGateApi {
  /** Lock the console now, in every open tab: end the session, show the gate. */
  lock: () => void;
}

const AdminGateContext = createContext<AdminGateApi | null>(null);

export function useAdminGate(): AdminGateApi {
  const api = useContext(AdminGateContext);
  if (!api) throw new Error("useAdminGate must be used inside <AdminGate>.");
  return api;
}

/** Renders its children only once this tab has been unlocked with the passcode. */
export default function AdminGate({ children }: { children: ReactNode }) {
  // null while rendering on the server, before this tab can be asked.
  const current = useSyncExternalStore(subscribe, getStatus, () => null);
  // Whether a locked page has finished throwing away any session it found.
  const [sessionCleared, setSessionCleared] = useState(false);
  // A passcode entered while the old session is still being ended must not be
  // undone by that request landing after it.
  const ending = useRef<Promise<unknown>>(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (current !== "locked" || sessionCleared) return;
    let live = true;
    // Opened from the Workspace's app switcher: a one-off launch ticket in the
    // address stands in for the passcode. Taken out of the address at once,
    // so it is never bookmarked, shared or reused by Back.
    const url = new URL(window.location.href);
    const ticket = url.searchParams.get("launch");
    if (ticket) {
      url.searchParams.delete("launch");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    ending.current = endSessionAfter(ending.current);
    ending.current
      .then(() =>
        ticket
          ? fetch("/api/onboarding/admin/sso", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ticket }),
            }).catch(() => null)
          : null,
      )
      .then((response) => {
        if (!live) return;
        if (response?.ok) setStatus("open");
        else setSessionCleared(true);
      });
    return () => {
      live = false;
    };
  }, [current, sessionCleared]);

  useEffect(() => {
    // Lock pressed in another tab locks this one too.
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(LOCK_CHANNEL);
      channel.current.onmessage = (event) => {
        if (event.data === "lock") setStatus("locked");
      };
    }
    // Coming Back to the console from the browser's page cache counts as
    // opening it again.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && status !== "locked") {
        ending.current = endSessionAfter(ending.current);
        setStatus("locked");
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const lock = useCallback(() => {
    ending.current = endSessionAfter(ending.current);
    setStatus("locked");
    channel.current?.postMessage("lock");
  }, []);

  const api = useMemo(() => ({ lock }), [lock]);

  if (current === null) return null;

  const showGate = current === "expired" || (current === "locked" && sessionCleared);
  const keepPage = current !== "locked";

  // The page keeps the same place in the tree whether or not the gate covers
  // it, so React holds on to its state while the passcode is asked again.
  return (
    <>
      {showGate && (
        <PasscodeGate
          resuming={current === "expired"}
          sessionEnded={() => ending.current}
          onDone={() => setStatus("open")}
        />
      )}
      {keepPage && (
        <div hidden={current !== "open"}>
          <AdminGateContext.Provider value={api}>{children}</AdminGateContext.Provider>
        </div>
      )}
    </>
  );
}

/** Signs out of the console on this device and returns to the passcode gate. */
export function LockButton() {
  const { lock } = useAdminGate();
  return (
    <Button variant="ghost" onClick={lock}>
      <Lock className="size-4" aria-hidden />
      Lock
    </Button>
  );
}

function PasscodeGate({
  resuming,
  sessionEnded,
  onDone,
}: {
  resuming: boolean;
  sessionEnded: () => Promise<unknown>;
  onDone: () => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // On the single website, founders open the console from the Workspace instead.
  const [hub, setHub] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding/admin/sso")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHub(Boolean(data?.hub)))
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setMessage(null);

    await sessionEnded();
    const response = await fetch("/api/onboarding/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    setBusy(false);

    if (!response?.ok) {
      setMessage(response ? "Incorrect passcode." : "Could not reach the server. Try again.");
      return;
    }
    onDone();
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Wordmark subtitle="HR console" href="/hr/admin" />
        <ThemeToggle />
      </div>
      <Card>
        <SectionTitle
          title={resuming ? "Session ended" : "Founders only"}
          lead={
            resuming
              ? "Your session ended — two hours passed, or the console was opened in another tab. Enter the passcode to carry on where you left off; nothing on this page is lost."
              : "This console shows candidates' identity documents. Enter the shared passcode to continue — it is asked for every time the console is opened."
          }
        />
        <div className="space-y-4">
          {hub && (
            <>
              <a
                href="/launch/hr"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-bold"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-fg)" }}
              >
                Sign in with the Workspace
              </a>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                Founders only. Or use the shared passcode:
              </p>
            </>
          )}
          <Field label="Passcode">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && passcode && !busy && submit()}
              className={inputClass}
              style={inputStyle}
              autoComplete="off"
              autoFocus
            />
          </Field>
          {message && <Notice tone="bad">{message}</Notice>}
          <Button disabled={busy || !passcode} onClick={submit}>
            {busy ? "Checking…" : "Enter"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Moves between the three apps on the single Focus Realm website. Founders can
 * use all three, so both links show. Plain <a>: each app is a separate site
 * behind the same address, so it is a full page load (see next.config.ts).
 * Shows nothing until the console sits behind that website.
 */
export function AppSwitcher() {
  const [hub, setHub] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding/admin/sso")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setHub(Boolean(data?.hub)))
      .catch(() => {});
  }, []);

  if (!hub) return null;
  const link = "inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold";
  return (
    <nav aria-label="Focus Realm apps" className="flex items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- "/" is the Workspace, another app on this address */}
      <a href="/" className={link} style={{ border: "1px solid var(--line)" }}>
        Workspace
      </a>
      <span className={link} style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand-soft-fg)" }} aria-current="page">
        HR console
      </span>
      <a href="/crm" className={link} style={{ border: "1px solid var(--line)" }}>
        Sales CRM
      </a>
    </nav>
  );
}
