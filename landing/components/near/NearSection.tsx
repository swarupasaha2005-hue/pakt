"use client";

import Image from "next/image";
import { BrandMark } from "@/components/hero/BrandMark";
import { PixelField } from "./PixelField";
import { useNearTransition } from "./useNearTransition";
import "./near-section.css";

function NearMark({ decorative = false }: { decorative?: boolean }) {
  return <Image src="/near-logo.webp" width={500} height={500} alt={decorative ? "" : "NEAR Protocol"} loading="eager" unoptimized />;
}

export function NearSection() {
  const { section, overlay, rotor, scan, settled, label, headline, description } = useNearTransition();

  return (
    <section ref={section} className="near-section" aria-labelledby="near-title">
      <div className="near-stage">
        <PixelField />
        <div ref={settled} className="near-stage__logo"><NearMark /></div>
        <div className="near-copy">
          <p ref={label} className="near-label">Designed for NEAR</p>
          <h2 ref={headline} id="near-title" className="near-title"><span>One vault.</span><span>Shared decisions.</span></h2>
          <p ref={description} className="near-description">Pool funds, choose a trader by vote, and set trading limits together. Explore the demo while NEAR wallet and contract integration is in development.</p>
        </div>
      </div>
      <div ref={overlay} className="near-transition-logo" aria-hidden="true">
        <div ref={rotor} className="near-transition-rotor">
          <div className="near-transition-face near-transition-face--pakt"><BrandMark prominent decorative /></div>
          <div className="near-transition-face near-transition-face--near"><NearMark decorative /></div>
        </div>
        <div ref={scan} className="near-transition-scan"><div className="scan-window"><div className="scan-beam" /></div></div>
      </div>
    </section>
  );
}
