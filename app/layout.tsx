import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

/**
 * Root chrome for Focus Realm HR.
 *
 * This app serves one thing: the onboarding, employee-portal and founders'
 * console routes under /hr. The per-section chrome lives in app/hr/layout.tsx,
 * so this layout only sets up fonts, the stylesheet and the document shell.
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Focus Realm HR",
    template: "%s · Focus Realm HR",
  },
  description:
    "Onboarding, documents and certificates for Focus Realm interns and employees.",
  // The whole surface is private: invitation links and the founders' console
  // should never be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#081527",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
