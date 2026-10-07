import { redirect } from "next/navigation";

/**
 * Nothing lives at the root of this app — every surface is under /hr. Interns
 * arrive on a tokenised invitation link and the founders' console sits behind a
 * passcode, so the bare domain just forwards to the HR entry point.
 */
export default function Home() {
  redirect("/hr");
}
