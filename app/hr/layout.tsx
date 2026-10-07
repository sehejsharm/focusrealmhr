import type { Metadata } from "next";
import { Inter } from "next/font/google";

/**
 * Chrome for Focus Realm HR — onboarding, the employee portal and the founders'
 * console. Navy and gold with Inter, per the current Focus Realm brand system —
 * deliberately unlike the hospitality product demo this repo also serves.
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

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
  return (
    <div
      className={`${inter.variable} fr-root min-h-screen`}
      style={{ fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
