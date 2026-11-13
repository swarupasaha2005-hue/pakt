"use client";

import { createPortal } from "react-dom";
import { BrandMark } from "@/components/hero/BrandMark";
import { NearMark } from "./NearMark";
import { PixelField } from "./PixelField";
import { useNearTransition } from "./useNearTransition";
import "./near-section.css";

export function NearSection() {
  const { section, overlay, rotor, scan, settled, headline, description, mounted } = useNearTransition();

  return (
    <section ref={section} className="near-section" aria-labelledby="near-title">
      <div className="near-stage">
        <PixelField />
        <div ref={settled} className="near-stage__logo">
          <NearMark />
          <div className="near-loop" aria-hidden="true">
            <div className="near-loop-rotor">
              <div className="near-loop-face near-loop-face--near"><NearMark decorative /></div>
              <div className="near-loop-face near-loop-face--pakt"><BrandMark prominent decorative /></div>
            </div>
          </div>
        </div>
        <div className="near-copy">
          <h2 ref={headline} id="near-title" className="near-title">Capital, Together.</h2>
          <p ref={description} className="near-description">Pool capital. Choose traders. Set rules. Share profits.</p>
        </div>
      </div>
      {mounted && createPortal(
        <div ref={overlay} className="near-transition-logo" aria-hidden="true">
          <div ref={rotor} className="near-transition-rotor">
            <div className="near-transition-face near-transition-face--pakt">
              <BrandMark prominent decorative />
              <div ref={scan} className="near-transition-scan"><div className="scan-window"><div className="scan-beam" /></div></div>
            </div>
            <div className="near-transition-face near-transition-face--near"><NearMark decorative /></div>
          </div>
        </div>, document.body
      )}
    </section>
  );
}
