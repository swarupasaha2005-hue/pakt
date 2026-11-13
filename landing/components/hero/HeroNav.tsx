"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { landingNavigation, launchAppHref, type LandingNavigationItem } from "@/lib/hero";
import { BrandMark } from "./BrandMark";
import { ArrowUpRight, DiscordIcon, GithubIcon, MenuIcon, XIcon } from "./Icons";
import "./hero-nav.css";

function SocialIcons() {
  return (
    <div className="hero-nav__social" aria-label="PAKT community">
      <a href="https://github.com/swarupasaha2005-hue/pakt" target="_blank" rel="noreferrer" aria-label="PAKT on GitHub"><GithubIcon /></a>
      <span role="img" aria-label="X"><XIcon /></span>
      <span role="img" aria-label="Discord"><DiscordIcon /></span>
    </div>
  );
}

function NavigationLink({ item, close }: { item: LandingNavigationItem; close: () => void }) {
  const target = item.href.slice(1);
  return <a href={item.href} onClick={(event) => {
    const element = document.getElementById(target);
    if (!element) return;
    event.preventDefault();
    close();
    window.history.pushState(null, "", item.href);
    const navHeight = document.querySelector<HTMLElement>(".hero-header")?.getBoundingClientRect().height ?? 0;
    const top = element.getBoundingClientRect().top + window.scrollY - navHeight - 24;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top, behavior });
  }}>{item.label}</a>;
}

export function HeroNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const close = () => setMobileOpen(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !nav.current?.contains(event.target)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <header className="hero-header">
      <nav ref={nav} className="hero-nav" aria-label="Main navigation">
        <div className="hero-nav__row">
          <Link className="wordmark" href="/" aria-label="PAKT home"><BrandMark decorative /><span>PAKT</span></Link>
          <button type="button" className="menu-toggle" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="primary-navigation" onClick={() => setMobileOpen((open) => !open)}><MenuIcon open={mobileOpen} /></button>
          <div className="hero-nav__actions">
            <SocialIcons />
            <a className="hero-nav__launch" href={launchAppHref}>Launch App<ArrowUpRight /></a>
          </div>
        </div>
        <ul id="primary-navigation" className="hero-nav__links" data-open={mobileOpen}>
          {landingNavigation.map((item) => <li key={item.label}><NavigationLink item={item} close={close} /></li>)}
        </ul>
      </nav>
    </header>
  );
}
