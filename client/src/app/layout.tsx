import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { LeftPanel } from "@/components/left/LeftPanel";
import { Ticker } from "@/components/shell/Ticker";
import { TopBar } from "@/components/shell/TopBar";
import { WalletProvider } from "@/lib/near/wallet";
import "./globals.css";

// clean grotesk + tabular nums for prices
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pakt",
  description: "Pool funds with friends, hire a trader, split the profit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden font-sans">
        <WalletProvider>
          <TopBar />
          <div className="flex min-h-0 flex-1 gap-3 px-4 pt-1 pb-2">
            <LeftPanel />
            {/* center + right slots: each page renders <main> and optional <RightPanel> */}
            {children}
          </div>
          <Ticker />
        </WalletProvider>
      </body>
    </html>
  );
}
