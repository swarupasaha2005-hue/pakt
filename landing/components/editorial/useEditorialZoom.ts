"use client";

import { useEffect, useRef } from "react";
import { clamp } from "@/components/near/timeline";

export function useEditorialZoom() {
  const section = useRef<HTMLElement>(null);
  const composition = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = section.current;
    const canvas = composition.current;
    if (!root || !canvas) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function render() {
      frame = 0;
      const progress = motion.matches ? 1 : clamp((window.innerHeight - root!.getBoundingClientRect().top) / (window.innerHeight * .95));
      const eased = progress * progress * (3 - 2 * progress);
      canvas!.style.transform = `translate3d(0, ${(1 - eased) * 64}px, 0) scale(${.78 + eased * .22})`;
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    motion.addEventListener("change", schedule);
    render();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  return { section, composition };
}
