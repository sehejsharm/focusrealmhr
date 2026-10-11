import type { Metadata } from "next";

/**
 * Chrome for Focus Realm HR — onboarding, the employee portal and the founders'
 * console. It wears the same blue-and-white Focus Realm brand as the
 * Workspace: the page ground follows the theme (light by default, dark when
 * chosen) and nothing here is "always dark". Fonts and the theme are set up
 * once, in the root layout.
 */

export const metadata: Metadata = {
  title: "Focus Realm HR",
  description: "Onboarding, documents and certificates for Focus Realm interns and employees.",
  robots: { index: false, follow: false },
};

export default function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-bg text-fg">{children}</div>;
}
