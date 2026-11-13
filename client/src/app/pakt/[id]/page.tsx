import { PaktRoute } from "@/components/pakt/PaktRoute";
import { pakts } from "@/lib/mock/pakts";

export function generateStaticParams() {
  return pakts.map((p) => ({ id: p.id }));
}

export default async function PaktPage({ params, searchParams }: PageProps<"/pakt/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const pakt = pakts.find((p) => p.id === id);
  const invite = Array.isArray(query.invite) ? query.invite[0] : query.invite;
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const initialTab = requestedTab === "votes" || requestedTab === "trades" || requestedTab === "settlements" ? requestedTab : "members";
  return <PaktRoute id={id} initial={pakt ?? null} inviteToken={invite} initialTab={initialTab} />;
}
