import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/ProfileView";
import { isAccountId } from "@/lib/profile/format";

export default async function ProfilePage({ params }: PageProps<"/u/[account]">) {
  const { account } = await params;
  if (!isAccountId(account)) notFound();
  return <ProfileView key={account} account={account} />;
}
