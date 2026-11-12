import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { LeftPanel } from "@/components/left/LeftPanel";
import { Ticker } from "@/components/shell/Ticker";
import { TopBar } from "@/components/shell/TopBar";
import { MockSessionProvider } from "@/components/session/MockSessionProvider";
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
        <MockSessionProvider>
          <TopBar />
          <div className="flex min-h-0 flex-1 gap-3 px-4 pt-1 pb-2">
            <LeftPanel />
            {children}
          </div>
          <Ticker />
        </MockSessionProvider>
      </body>
    </html>
  );
}
