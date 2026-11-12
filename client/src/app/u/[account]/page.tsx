import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/ProfileView";
import { isAccountId } from "@/lib/profile/format";

export async function generateMetadata({ params }: PageProps<"/u/[account]">): Promise<Metadata> {
  const { account } = await params;
  return { title: account, description: `${account} on Pakt: pakts joined, trades, P/L and pakter record.`, robots: { index: false } };
}

export default async function ProfilePage({ params }: PageProps<"/u/[account]">) {
  const { account } = await params;
  if (!isAccountId(account)) notFound();
  return <ProfileView key={account} account={account} />;
}
