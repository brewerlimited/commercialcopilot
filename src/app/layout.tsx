import FeedbackWidget from "@/components/FeedbackWidget";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Commercial Co-Pilot",
  description: "Clause-ready drafts • Deterministic costing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-cc-theme="professional-light" data-cc-theme-choice="professional-light">
      <body>
        <AppearanceProvider>
          {children}
          <FeedbackWidget />
        </AppearanceProvider>
      </body>
    </html>
  );
}
