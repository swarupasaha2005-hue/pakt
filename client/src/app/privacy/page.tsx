import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="November 13, 2026">
      <p>Pakt has no accounts, no email sign-up and no ads. Here is everything it touches.</p>
      <h2>Public chain data</h2>
      <p>Your NEAR account id, deposits, votes and trades are public on the NEAR blockchain. Our indexer reads these public events and stores them so the site can show feeds, leaderboards and profiles. We can&apos;t delete on-chain data.</p>
      <h2>Your browser</h2>
      <p>The site keeps a few settings in your browser&apos;s local storage: starred pakts and tokens, whether you finished the site tour, and your wallet connection. They never leave your device. Clear your site data to remove them.</p>
      <h2>Our servers</h2>
      <p>Our backend sees your IP address on each request and uses it to rate-limit abuse. When you request test tokens, we store your account id and IP address with the time of the claim, to enforce the daily faucet limit. We never sell either.</p>
      <h2>Third parties</h2>
      <ul>
        <li>Your wallet (for example MyNearWallet, Meteor, HERE or HOT) handles signing under its own privacy policy.</li>
        <li>Chain data comes from NEAR RPC nodes. Token charts load from Coinbase&apos;s public market data API, straight from your browser.</li>
        <li>The backend (indexer and API) runs on Cloudflare.</li>
        <li>The site is hosted on Vercel, and Vercel Analytics counts page views without cookies or cross-site tracking.</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions? Open an issue on the project&apos;s GitHub repository.</p>
    </LegalPage>
  );
}
