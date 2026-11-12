"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { navigation } from "@/lib/hero";
import { BrandMark } from "./BrandMark";
import { DiscordIcon, GithubIcon, MenuIcon, XIcon } from "./Icons";

function SocialIcons() {
  return (
    <div className="social-icons" aria-label="PAKT community">
      <span className="social-icon" role="img" aria-label="GitHub"><GithubIcon /></span>
      <span className="social-icon social-icon--disc" role="img" aria-label="X"><XIcon /></span>
      <span className="social-icon social-icon--disc" role="img" aria-label="Discord"><DiscordIcon /></span>
    </div>
  );
}

export function HeroNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header className="hero-header">
      <nav className="hero-nav" aria-label="Main navigation">
        <div className="hero-nav__row">
          <Link className="wordmark" href="/" aria-label="PAKT home"><BrandMark decorative /><span>PAKT</span></Link>
          <div className="hero-nav__desktop">
            {navigation.map((item) => <a key={item.label} href={item.href}>{item.label}</a>)}
          </div>
          <div className="hero-nav__social"><SocialIcons /></div>
          <button type="button" className="menu-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}><MenuIcon open={open} /></button>
        </div>
        {open && <div id="mobile-navigation" className="hero-nav__mobile">
          {navigation.map((item) => <a key={item.label} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}
          <SocialIcons />
        </div>}
      </nav>
    </header>
  );
}
