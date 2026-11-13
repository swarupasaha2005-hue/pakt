"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function useFooterHeadingReveal(section: RefObject<HTMLElement | null>) {
  const headline = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const root = section.current;
    const title = headline.current;
    if (!root || !title) return;
    gsap.registerPlugin(ScrollTrigger);
    const words = Array.from(title.querySelectorAll<HTMLElement>(".collective-title__word"));
    const media = gsap.matchMedia();
    let refreshFrame = 0;
    let disposed = false;

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const fill = { distance: -16 };
      let widths: number[] = [];
      let total = 0, start = 0, end = 1;
      function measure() {
        widths = words.map((word) => word.getBoundingClientRect().width);
        total = widths.reduce((sum, width) => sum + width, 0);
        start = title!.getBoundingClientRect().top + window.scrollY - window.innerHeight;
        end = Math.max(start + 1, ScrollTrigger.maxScroll(window) - Math.min(16, window.innerHeight * .02));
      }
      function render() {
        let consumed = 0;
        words.forEach((word, index) => {
          word.style.setProperty("--footer-fill", `${fill.distance - consumed}px`);
          consumed += widths[index];
        });
      }
      measure();
      gsap.fromTo(fill, { distance: -16 }, {
        distance: () => total + 16,
        ease: "none",
        onUpdate: render,
        scrollTrigger: {
          id: "pakt-footer-heading", trigger: title,
          start: () => start, end: () => end,
          scrub: true, invalidateOnRefresh: true,
          onRefreshInit: measure, onRefresh: render,
        },
      });
      render();
      return () => words.forEach((word) => word.style.removeProperty("--footer-fill"));
    }, root);

    function scheduleRefresh() {
      if (disposed || refreshFrame) return;
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = 0;
        if (!disposed) ScrollTrigger.refresh();
      });
    }
    const observer = new ResizeObserver(scheduleRefresh);
    [root, title, document.querySelector(".terminal-section"), document.querySelector(".near-section")].forEach((node) => {
      if (node) observer.observe(node);
    });
    scheduleRefresh();
    void document.fonts.ready.then(scheduleRefresh);
    return () => {
      disposed = true;
      cancelAnimationFrame(refreshFrame);
      observer.disconnect();
      media.revert();
    };
  }, [section]);

  return headline;
}
