import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms · Pakt" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="November 13, 2026">
      <p>Pakt is a hackathon project. By using this site you agree to the terms below. If you don&apos;t agree, don&apos;t use it.</p>
      <h2>Testnet only</h2>
      <p>Pakt runs on NEAR testnet. Tokens here (tUSDC, tBTC, tNEAR) are test tokens with no real value. Never send mainnet funds to any Pakt account.</p>
      <h2>What Pakt is</h2>
      <p>Pakt is a set of smart contracts and a website. A pakt is a shared vault: members deposit, vote in a trader through a DAO, and the trader can only swap whitelisted tokens inside the budget and per-trade caps the members set. Profit above the high-water mark pays the trader&apos;s fee and a platform fee.</p>
      <h2>You hold your keys</h2>
      <p>Pakt never holds your private keys. Every action is a transaction you sign in your own wallet. We can&apos;t reverse, cancel or refund a transaction once it is on chain.</p>
      <h2>Risk</h2>
      <ul>
        <li>Traders can lose money, within the caps you agreed to.</li>
        <li>The contracts are unaudited and may have bugs.</li>
        <li>Prices come from an oracle fed by public price sources. They can be late or wrong.</li>
        <li>The site, the indexer or the price relay can be down at any time.</li>
      </ul>
      <h2>No advice</h2>
      <p>Nothing on Pakt is financial, investment or legal advice.</p>
      <h2>No warranty</h2>
      <p>Pakt is provided &quot;as is&quot;, without warranties of any kind. To the extent the law allows, the builders are not liable for any loss from using it.</p>
      <h2>Changes</h2>
      <p>We may change these terms or shut Pakt down at any time. The date at the top shows the latest version.</p>
    </LegalPage>
  );
}
