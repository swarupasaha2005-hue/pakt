import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { LeftPanel } from "@/components/left/LeftPanel";
import { Ticker } from "@/components/shell/Ticker";
import { TopBar } from "@/components/shell/TopBar";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pakt",
  description: "Pool funds with friends, hire a trader, split the profit.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="flex h-dvh flex-col overflow-hidden font-sans">
        <TopBar />
        <div className="flex min-h-0 flex-1 gap-3 px-4 pt-1 pb-2">
          <LeftPanel />
          {/* center + right slots: each page renders <main> and optional <RightPanel> */}
          {children}
        </div>
        <Ticker />
      </body>
    </html>
  );
}
