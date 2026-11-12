import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { LeftPanel } from "@/components/left/LeftPanel";
import { Ticker } from "@/components/shell/Ticker";
import { TopBar } from "@/components/shell/TopBar";
import { Tour } from "@/components/tour/Tour";
import { WalletProvider } from "@/lib/near/wallet";
import "./globals.css";


export const metadata: Metadata = {
  title: "Pakt",
  description: "Pool funds with friends, hire a trader, split the profit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <head>
        {/* General Sans (Fontshare, free license): closest free match to the Aeonik look */}
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" />
      </head>
      <body className="flex h-dvh flex-col overflow-hidden font-sans tabular-nums">
        <WalletProvider>
          <TopBar />
          <Tour />
          <div className="flex min-h-0 flex-1 gap-3 px-4 pt-1 pb-2">
            <LeftPanel />
            {/* center + right slots: each page renders <main> and optional <RightPanel> */}
            {children}
          </div>
          <Ticker />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
