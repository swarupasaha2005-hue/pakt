"use client";

import { useEffect, useRef } from "react";

export function useLandingProgress() {
  const indicator = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = indicator.current;
    if (!root) return;
    const blocks = root.querySelectorAll<HTMLElement>(".landing-progress__block");
    const sections = [".near-section", ".editorial-section", ".terminal-section", ".collective-section"].map((selector) => document.querySelector<HTMLElement>(selector));
    const labels = ["Introduction", "Capital, Together.", "Collective Capital", "PAKT Terminal", "Explore PAKT", "Trading, together."];
    let active = 1;
    let frame = 0;
    function render() {
      frame = 0;
      let next = 1;
      sections.forEach((section, index) => {
        if (section && section.getBoundingClientRect().top <= window.innerHeight / 2) next = index + 2;
      });
      const footerTitle = document.getElementById("collective-title");
      if (footerTitle && footerTitle.getBoundingClientRect().top <= window.innerHeight * .95) next = 6;
      if (next === active) return;
      active = next;
      root!.setAttribute("aria-valuenow", String(next));
      root!.setAttribute("aria-valuetext", labels[next - 1]);
      blocks.forEach((block, index) => { block.dataset.active = String(index < next); });
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    render();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
    };
  }, []);
  return indicator;
}
