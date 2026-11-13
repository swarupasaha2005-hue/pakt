"use client";

import { ArrowRight } from "@/components/hero/Icons";
import { heroLinks } from "@/lib/hero";
import { CollectiveGrid } from "./CollectiveGrid";
import { useFooterHeadingReveal } from "./useFooterHeadingReveal";
import { useCollectiveReveal } from "./useCollectiveReveal";
import "./collective.css";

export function CollectiveSection() {
  const section = useCollectiveReveal();
  const headline = useFooterHeadingReveal(section);
  return (
    <footer ref={section} className="collective-section" aria-labelledby="collective-title">
      <svg className="collective-background" viewBox="0 0 1600 1000" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path d="M240 0V180 M1360 0V180 M0 180H240 M1360 180H1600 M100 850H240 M1360 850H1500" />
        <g fill="currentColor" stroke="none"><circle cx="240" cy="180" r="2" /><circle cx="1360" cy="180" r="2" /></g>
      </svg>
      <CollectiveGrid />
      <div className="collective-content">
        <p className="collective-description">Pool capital. Choose your trader. Set the rules. Share the upside.</p>
        <a className="hero-cta hero-cta--primary collective-cta" href={heroLinks[0].href}>
          Explore PAKT<span className="hero-cta__arrow"><ArrowRight /></span>
        </a>
        <h2 ref={headline} id="collective-title"><span className="collective-title__word">Trading,</span>{" "}<span className="collective-title__word">together.</span></h2>
      </div>
    </footer>
  );
}
