"use client";

import { BrandMark } from "@/components/hero/BrandMark";
import { NearMark } from "./NearMark";
import { PixelField } from "./PixelField";
import { useNearTransition } from "./useNearTransition";
import "./near-section.css";

export function NearSection() {
  const { section, overlay, rotor, upperRotor, scan, settled, label, headline, description } = useNearTransition();

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
        <div className="near-transition-upper">
          <div ref={upperRotor} className="near-transition-rotor">
            <BrandMark prominent decorative />
            <div ref={scan} className="near-transition-scan"><div className="scan-window"><div className="scan-beam" /></div></div>
          </div>
        </div>
        <div className="near-transition-lower">
          <div ref={rotor} className="near-transition-rotor">
            <div className="near-transition-face near-transition-face--pakt"><BrandMark prominent decorative /></div>
            <div className="near-transition-face near-transition-face--near"><NearMark decorative /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
