import FeedbackWidget from "@/components/FeedbackWidget";
import { AppearanceProvider } from "@/components/AppearanceProvider";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://commercialcopilot.co.uk"),
  title: {
    default: "Commercial Co-Pilot | Commercial recovery software for subcontractors",
    template: "%s | Commercial Co-Pilot",
  },
  description: "Commercial management and recovery software for subcontractors managing EWNs, CEs, variations, evidence, cost build-ups and payment tracking.",
  applicationName: "Commercial Co-Pilot",
  keywords: [
    "commercial management software",
    "compensation event software",
    "variation management software",
    "EWN register",
    "NEC subcontractor software",
    "JCT subcontractor software",
    "payment tracking",
    "commercial recovery",
  ],
  authors: [{ name: "Commercial Co-Pilot" }],
  creator: "Commercial Co-Pilot",
  publisher: "Commercial Co-Pilot",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Commercial Co-Pilot",
    title: "Commercial Co-Pilot | Commercial recovery software for subcontractors",
    description: "Track EWNs, build stronger CEs and variations, support entitlement, price cost build-ups and manage recovery through to payment.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Commercial Co-Pilot dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Commercial Co-Pilot | Commercial recovery software for subcontractors",
    description: "Commercial management and recovery software for EWNs, CEs, variations, evidence, cost build-ups and payment tracking.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
