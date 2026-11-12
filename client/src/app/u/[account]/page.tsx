import { notFound } from "next/navigation";
import { ProfileView } from "@/components/profile/ProfileView";
import { feed } from "@/lib/mock/feed";
import { pakts } from "@/lib/mock/pakts";
import { positions } from "@/lib/mock/positions";
import { profiles } from "@/lib/mock/profiles";

export function generateStaticParams() {
  return profiles.map((p) => ({ account: p.account }));
}

export default async function ProfilePage({ params }: PageProps<"/u/[account]">) {
  const { account } = await params;
  const profile = profiles.find((p) => p.account === account);
  if (!profile) notFound();

  const related = pakts.filter((p) => p.trader === account || p.members.some((m) => m.account === account));
  const owners = [account, ...related.map((p) => p.id)];

  return (
    <ProfileView
      profile={profile}
      positions={positions.filter((p) => owners.includes(p.owner))}
      pakts={related}
      events={feed.filter((e) => e.actor === account)}
    />
  );
}
