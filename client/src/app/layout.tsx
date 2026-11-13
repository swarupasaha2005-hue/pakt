import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LeftPanel } from "@/components/left/LeftPanel";
import { MobileNav } from "@/components/shell/MobileNav";
import { Ticker } from "@/components/shell/Ticker";
import { TopBar } from "@/components/shell/TopBar";
import { Tour } from "@/components/tour/Tour";
import { SITE } from "@/lib/config";
import { WalletProvider } from "@/lib/near/wallet";
import "./globals.css";


const OG_IMAGE = { url: "/paktdotfam.vercel.app.jpg", width: 1920, height: 1080, alt: "pakt · paktdotfam.vercel.app" };
const DESCRIPTION = "Pakt is a social group trading vault on NEAR. Pool funds with friends, vote in a pakter who trades the vault but can never withdraw it, and split the profit.";

export const metadata: Metadata = {
  // absolute og:image urls for share cards
  metadataBase: new URL(SITE),
  title: { default: "Pakt · Trade with fam", template: "%s · Pakt" },
  description: DESCRIPTION,
  applicationName: "Pakt",
  keywords: ["Pakt", "NEAR", "group trading", "social trading", "crypto vault", "DAO", "copy trading", "pool funds with friends", "on-chain vault", "NEAR Protocol"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Pakt", title: "Pakt · Trade with fam", description: DESCRIPTION, url: "/", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", site: "@paktdotfam", title: "Pakt · Trade with fam", description: DESCRIPTION, images: [OG_IMAGE] },
  robots: { index: true, follow: true },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pakt",
  url: SITE,
  description: DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <head>
        {/* General Sans (Fontshare, free license): closest free match to the Aeonik look */}
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden font-sans tabular-nums">
        <WalletProvider>
          <TopBar />
          <Tour />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 pt-1 pb-20 md:flex-row md:overflow-hidden md:px-4 md:pb-2">
            <LeftPanel />
            {/* center + right slots: each page renders <main> and optional <RightPanel> */}
            {children}
          </div>
          <Ticker />
          {/* why: usePathname suspends on unprerendered dynamic routes */}
          <Suspense>
            <MobileNav />
          </Suspense>
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
