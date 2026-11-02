import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { DemoStrip, SiteFooter, SiteHeader } from "@/components/site-header";
import "./globals.css";

// Inter for reading and UI; Inter Tight for headings and numbers.
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const display = Inter_Tight({ variable: "--font-display-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MealBridge", template: "%s · MealBridge" },
  description: "Tonight's surplus restaurant food, to tonight's shelter meals. Volunteer drivers reimbursed through PayPal before they get home.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfaf6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e100f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a href="#main" className="sr-only z-[2000] rounded-md bg-bg px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <DemoStrip />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
