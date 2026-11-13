"use client";

import Image from "next/image";
import { useTerminalSequence } from "./useTerminalSequence";
import "./terminal.css";

const CARDS = [
  { image: "ref3.jpg", title: "Discover", description: "Compare trading pools, vault values, traders, and member counts.", alt: "PAKT pool discovery with vault values, traders, fees, and member counts" },
  { image: "ref4.jpg", title: "Manage", description: "Review your pool share, trading budget, limits, and member activity.", alt: "PAKT pool detail with member shares, trading limits, a performance chart, and management controls" },
  { image: "ref5.jpg", title: "Govern", description: "Participate in collective decisions and trader governance.", alt: "PAKT token view with a tUSDC chart, oracle price, and pools holding the token" },
  { image: "ref6.jpg", title: "Track", description: "Monitor trading performance, settlements, and profit sharing.", alt: "PAKT account profile showing holdings, trading volume, pool memberships, and an activity feed" },
];

export function TerminalSequence() {
  const { section, stage, stack, strip } = useTerminalSequence();
  return (
    <section ref={section} className="terminal-section" aria-labelledby="terminal-title">
      <h2 id="terminal-title" className="sr-only">Inside the PAKT terminal</h2>
      <div ref={stage} className="terminal-stage">
        <div ref={strip} className="terminal-strip" aria-hidden="true">
          {Array.from({ length: 4 }, (_, repeat) => <div className="terminal-strip__cycle" key={repeat}>
            {["Trade", "Pool", "Govern", "Track"].map((label) => <span key={label}>{label}<i>+</i><b>/</b></span>)}
          </div>)}
        </div>
        <div ref={stack} className="terminal-stack">
          <div className="terminal-backing terminal-backing--back" aria-hidden="true" />
          <div className="terminal-backing terminal-backing--front" aria-hidden="true" />
          {CARDS.map((card, index) => <article className="terminal-card" key={card.image} style={{ zIndex: CARDS.length - index }}>
            <div className="terminal-card__screen">
              <Image src={`/images/terminal/${card.image}`} alt={card.alt} width={1600} height={917} unoptimized sizes="(max-width: 760px) 80vw, 460px" />
            </div>
            <div className="terminal-card__copy">
              <h3>{card.title}</h3>
              <span className="terminal-card__number" aria-hidden="true">0{index + 1} / 04</span>
              <p>{card.description}</p>
            </div>
          </article>)}
        </div>
      </div>
    </section>
  );
}
