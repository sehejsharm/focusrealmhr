import type { Candidate } from "./types";

/**
 * Several people may share one email — a family inbox, a recruiter's address,
 * a shared company mailbox. That is allowed: an email is never how the console
 * or the Workspace tells people apart (the candidate id is), and never a login
 * (the Workspace employee ID is). This only lets the founders see who else
 * uses an address, so nobody is surprised by it.
 */

export interface SharedEmailMatch {
  id: string;
  name: string;
  /** The address they have in common, as stored on the other person's record. */
  email: string;
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}

/** Every address on a record: the one they were invited at, and their company mailbox. */
function emailsOf(candidate: Candidate): string[] {
  return [candidate.invitedEmail, candidate.mailbox?.address].filter((e): e is string => Boolean(e));
}

/** The other people whose invite address or mailbox matches any of `emails`. */
export function othersUsingEmails(
  emails: string[],
  all: Candidate[],
  exceptId?: string,
): SharedEmailMatch[] {
  const wanted = new Set(emails.map(normalise).filter(Boolean));
  if (wanted.size === 0) return [];

  const matches: SharedEmailMatch[] = [];
  for (const other of all) {
    if (other.id === exceptId) continue;
    const shared = emailsOf(other).find((e) => wanted.has(normalise(e)));
    if (shared) {
      matches.push({ id: other.id, name: other.details?.fullName ?? other.invitedName, email: shared });
    }
  }
  return matches;
}

/** The other people sharing an address with this candidate. */
export function othersSharingEmail(candidate: Candidate, all: Candidate[]): SharedEmailMatch[] {
  return othersUsingEmails(emailsOf(candidate), all, candidate.id);
}
