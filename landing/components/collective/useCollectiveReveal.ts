"use client";

import { useEffect, useRef } from "react";
import { smoothRange } from "@/components/near/timeline";

export function useCollectiveReveal() {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function render() {
      frame = 0;
      const progress = (window.innerHeight - root!.getBoundingClientRect().top) / Math.min(window.innerHeight, root!.offsetHeight);
      const values = motion.matches ? [1, 1, 1] : [
        smoothRange(.08, .8, progress),
        smoothRange(.45, .92, progress), smoothRange(.55, 1, progress),
      ];
      ["grid", "description", "cta"].forEach((name, i) => root!.style.setProperty(`--collective-${name}`, String(values[i])));
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(render);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    render();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  return section;
}
