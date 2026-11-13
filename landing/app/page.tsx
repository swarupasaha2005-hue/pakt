import { Hero } from "@/components/hero/Hero";
import { CollectiveSection } from "@/components/collective/CollectiveSection";
import { NearSection } from "@/components/near/NearSection";
import { EditorialSection } from "@/components/editorial/EditorialSection";
import { TerminalSequence } from "@/components/terminal/TerminalSequence";
import { ScrollProgress } from "@/components/progress/ScrollProgress";

export default function Home() {
  return <><Hero /><NearSection /><EditorialSection /><TerminalSequence /><CollectiveSection /><ScrollProgress /></>;
}
