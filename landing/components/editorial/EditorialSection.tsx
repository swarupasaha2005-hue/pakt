"use client";

import Image from "next/image";
import { ArrowRight } from "@/components/hero/Icons";
import { heroLinks } from "@/lib/hero";
import { useEditorialZoom } from "./useEditorialZoom";
import "./editorial.css";

const FEATURES = [
  { title: "Collective Capital", description: "Pool funds with other members into a shared trading group." },
  { title: "Community Governance", description: "Vote on traders and establish trading limits collectively." },
  { title: "Transparent Profit Sharing", description: "Track performance and distribute profits according to your group’s rules." },
];

export function EditorialSection() {
  const { section, composition } = useEditorialZoom();
  return (
    <section ref={section} id="editorial" className="editorial-section" aria-labelledby="editorial-title">
      <div ref={composition} className="editorial-composition">
        <figure className="editorial-image editorial-image--large">
          <Image src="/references/ref1.png" alt="A luminous teal train traveling through a modern curved tunnel" fill unoptimized sizes="(max-width: 760px) 90vw, (max-width: 1100px) 45vw, 38vw" />
          <figcaption className="editorial-image-caption">
            <span className="editorial-members" aria-hidden="true"><i /><i /><i /></span>
            <span>Shared capital.<br />Shared decisions.</span>
          </figcaption>
        </figure>
        <div className="editorial-intro">
          <h2 id="editorial-title">Capital moves<br />better together.</h2>
          <p>Pool funds. Choose who trades. Set limits together.</p>
          <a className="editorial-cta" href={heroLinks[0].href}>Explore the demo <ArrowRight /></a>
        </div>
        <div className="editorial-right">
          <figure className="editorial-image editorial-image--small">
            <Image src="/references/ref2.png" alt="A close-up of a glowing teal pocket watch amid flowing light" fill unoptimized sizes="(max-width: 760px) 75vw, (max-width: 1100px) 35vw, 26vw" />
          </figure>
          <div className="editorial-info">
            <span className="editorial-info__symbol" aria-hidden="true">+</span>
            <p>Your pool.<br />Your rules.</p>
            <span className="editorial-info__tag">Community governed</span>
          </div>
        </div>
        <dl className="editorial-features">
          {FEATURES.map((feature) => <div className="editorial-feature" key={feature.title}>
            <dt id={feature.title === "Collective Capital" ? "pools" : feature.title === "Community Governance" ? "governance" : undefined}><span className="editorial-plus" aria-hidden="true">+</span><span>{feature.title}</span></dt>
            <dd>{feature.description}</dd>
          </div>)}
        </dl>
      </div>
    </section>
  );
}
