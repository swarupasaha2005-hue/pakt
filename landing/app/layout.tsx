import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Match the dApp typography configuration on staging/p1.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PAKT — Pool funds. Choose who trades.",
  description: "Explore PAKT: pool funds with friends, vote on a trader, and set the rules together.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
