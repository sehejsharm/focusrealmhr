import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeSync } from "@/components/onboarding/ui";
import "./globals.css";

/**
 * Root chrome for Focus Realm HR.
 *
 * This app serves one thing: the onboarding, employee-portal and founders'
 * console routes under /hr. The per-section chrome lives in app/hr/layout.tsx,
 * so this layout only sets up fonts, the theme, the stylesheet and the
 * document shell.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
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
  // Mirrors --bg in each theme (app/globals.css). A value that leaves CSS, so
  // the brand rules allow it here as a literal.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#060a13" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Runs before first paint: applies the saved theme ("fr-theme": light, dark
 * or system; light by default), so the page never flashes the wrong one. The
 * same key and rules as the Focus Realm Workspace.
 */
const themeBootScript = `(function(){try{var t=localStorage.getItem('fr-theme')||'light';var dark=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
