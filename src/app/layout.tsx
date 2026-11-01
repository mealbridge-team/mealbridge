import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import { DemoBar, SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: "MealBridge",
  description: "Tonight's surplus restaurant food, to tonight's shelter meals. Volunteer drivers reimbursed through PayPal before they get home.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <DemoBar />
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-5 text-xs text-muted">
            <p>MealBridge, built for the PayPal AI Hackathon. Payments use PayPal sandbox money.</p>
            <p>Every business, shelter and person shown is fictional.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
