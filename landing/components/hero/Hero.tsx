import { heroLinks } from "@/lib/hero";
import { ArrowRight } from "./Icons";
import { HeroNav } from "./HeroNav";
import { TechnicalScene } from "./TechnicalScene";

export function Hero() {
  return (
    <main className="landing-hero">
      <HeroNav />
      <section className="hero-content" aria-labelledby="hero-title">
        <h1 id="hero-title"><span>Pool funds together.</span><span>Choose who trades.</span></h1>
        <div className="hero-actions">
          {heroLinks.map((link, index) => (
            <a key={link.label} href={link.href} className={`hero-cta${index === 0 ? " hero-cta--primary" : ""}`}>
              {link.label}<span className="hero-cta__arrow"><ArrowRight /></span>
            </a>
          ))}
        </div>
        <TechnicalScene />
      </section>
    </main>
  );
}
