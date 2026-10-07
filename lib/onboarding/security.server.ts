import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Secrets, tokens, and the admin session cookie. SERVER ONLY.
 *
 * Two things here are deliberately strict in production: the module refuses to
 * start without real secrets, and the admin passcode is compared in constant
 * time. Both matter because this module gates access to candidates' Aadhaar
 * details.
 */

const DEV_SECRET = "focusrealm-onboarding-dev-secret-do-not-use-in-production";
const DEV_PASSCODE = "focusrealm-dev";

function requireEnv(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${name} must be set. The onboarding module handles Aadhaar data and refuses to run without it.`,
    );
  }
  return devFallback;
}

function secret(): string {
  return requireEnv("ONBOARDING_SECRET", DEV_SECRET);
}

function key(): Buffer {
  return scryptSync(secret(), "focusrealm-onboarding", 32);
}

/** Bearer credential embedded in the candidate's onboarding link. */
export function createToken(): string {
  return randomBytes(24).toString("base64url");
}

export function createId(): string {
  return randomBytes(8).toString("hex");
}

export function generatePassword(): string {
  // Ambiguity-free alphabet: no O/0, l/1/I. Candidates type these by hand.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/* -------------------------------------------------------------------------- */
/* Sealing — used for the temporary mailbox password                          */
/* -------------------------------------------------------------------------- */

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function unseal(sealed: string): string | null {
  try {
    const [ivPart, tagPart, dataPart] = sealed.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;

    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Admin session                                                              */
/* -------------------------------------------------------------------------- */

export const ADMIN_COOKIE = "fr_onboarding_admin";

export function checkPasscode(supplied: string): boolean {
  const expected = requireEnv("ONBOARDING_ADMIN_PASSCODE", DEV_PASSCODE);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, so compare digests instead.
  return timingSafeEqual(
    createHmac("sha256", secret()).update(a).digest(),
    createHmac("sha256", secret()).update(b).digest(),
  );
}

/** Session value is `expiry.signature` — no server-side session table needed. */
export function issueAdminSession(hours = 12): string {
  const expiry = String(Date.now() + hours * 3600_000);
  const sig = createHmac("sha256", secret()).update(expiry).digest("base64url");
  return `${expiry}.${sig}`;
}

export function verifyAdminSession(value: string | undefined): boolean {
  if (!value) return false;

  const [expiry, sig] = value.split(".");
  if (!expiry || !sig) return false;

  const expected = createHmac("sha256", secret()).update(expiry).digest("base64url");
  if (sig.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;

  return Number(expiry) > Date.now();
}

/* -------------------------------------------------------------------------- */
/* Aadhaar                                                                    */
/* -------------------------------------------------------------------------- */

export function normaliseAadhaar(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidAadhaar(digits: string): boolean {
  return /^\d{12}$/.test(digits);
}

/** What anyone other than an authenticated admin is allowed to see. */
export function maskAadhaar(digits: string): string {
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/* -------------------------------------------------------------------------- */
/* Offboarding links                                                          */
/* -------------------------------------------------------------------------- */

function offboardingSignature(id: string): string {
  return createHmac("sha256", secret()).update(`offboarding:${id}`).digest("base64url").slice(0, 32);
}

/**
 * `id.signature`. Derived from the record rather than stored, so it exists the
 * moment it is needed and only this server can mint one. It stops working
 * when the person is removed, because the record is then archived.
 */
export function offboardingCode(id: string): string {
  return `${id}.${offboardingSignature(id)}`;
}

/** The record id a genuine offboarding code belongs to, or null. */
export function verifyOffboardingCode(code: string): string | null {
  const [id, sig, extra] = code.split(".");
  if (!id || !sig || extra !== undefined || !/^[a-z0-9]{1,64}$/i.test(id)) return null;

  const expected = offboardingSignature(id);
  if (sig.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? id : null;
}
