"use client";

import { useEffect, useRef } from "react";
import { clamp, nearTimeline } from "./timeline";

export function useNearTransition() {
  const section = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const rotor = useRef<HTMLDivElement>(null);
  const scan = useRef<HTMLDivElement>(null);
  const settled = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLParagraphElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const description = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const root = section.current;
    const floating = overlay.current;
    const rotation = rotor.current;
    const scanLayer = scan.current;
    const destination = settled.current;
    const eyebrow = label.current;
    const title = headline.current;
    const detail = description.current;
    const hero = document.querySelector<HTMLElement>(".landing-hero");
    const header = hero?.querySelector<HTMLElement>(".hero-header");
    const mark = hero?.querySelector<HTMLElement>(".brand-mark--hero");
    const original = hero?.querySelector<HTMLElement>(".logo-frame__mark");
    const frame = hero?.querySelector<HTMLElement>(".logo-frame");
    if (!root || !floating || !rotation || !scanLayer || !destination || !eyebrow || !title || !detail || !hero || !header || !mark || !original || !frame) return;

    const savedHeader = { position: header.style.position, top: header.style.top, left: header.style.left, right: header.style.right };
    const savedPadding = hero.style.paddingTop;
    const savedVisibility = original.style.visibility;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let scheduled = 0;
    let disposed = false;
    let start = 0, end = 1, release = 1;
    let initialSize = 0, finalSize = 0, pinCenter = 0, finalCenter = 0;
    let sourceCenterX = 0, finalCenterX = 0;
    let headerHeight = 0;

    function pinHeader() {
      if (window.scrollY > 0) {
        hero!.style.paddingTop = `${headerHeight}px`;
        Object.assign(header!.style, { position: "fixed", top: "0px", left: "0px", right: "0px" });
      } else {
        hero!.style.paddingTop = savedPadding;
        Object.assign(header!.style, savedHeader);
      }
    }

    function reveal(node: HTMLElement, opacity: number, distance: number) {
      node.style.opacity = String(opacity);
      node.style.transform = `translate3d(0, ${(1 - opacity) * distance}px, 0)`;
    }

    function synchronizeScan() {
      const sourceAnimation = hero!.querySelector(".scan-beam")?.getAnimations()[0];
      const copiedAnimation = floating!.querySelector(".scan-beam")?.getAnimations()[0];
      if (sourceAnimation && copiedAnimation) {
        copiedAnimation.currentTime = sourceAnimation.currentTime;
        if (sourceAnimation.playState === "paused") copiedAnimation.pause();
      }
    }

    function render() {
      scheduled = 0;
      if (disposed) return;
      const y = window.scrollY;
      pinHeader();
      const progress = clamp((y - start) / (end - start));
      root!.style.setProperty("--near-progress", String(progress));
      if (motion.matches) {
        original!.style.visibility = savedVisibility;
        floating!.style.visibility = "hidden";
        floating!.style.display = "none";
        destination!.style.visibility = "visible";
        reveal(eyebrow!, 1, 0); reveal(title!, 1, 0); reveal(detail!, 1, 0);
        return;
      }
      const state = nearTimeline(progress);
      const active = y >= start && y < release - .5;
      const entering = active && floating!.style.display !== "block";
      floating!.style.display = active ? "block" : "none";
      if (entering) synchronizeScan();
      original!.style.visibility = active ? "hidden" : savedVisibility;
      floating!.style.visibility = active ? "visible" : "hidden";
      destination!.style.visibility = y >= release - .5 ? "visible" : "hidden";
      const size = initialSize + (finalSize - initialSize) * state.settle;
      const center = pinCenter + (finalCenter - pinCenter) * state.settle;
      const centerX = sourceCenterX + (finalCenterX - sourceCenterX) * state.settle;
      floating!.style.transform = `translate3d(${centerX - initialSize / 2}px, ${center - initialSize / 2}px, 0) scale(${size / initialSize})`;
      rotation!.style.transform = `rotateZ(${state.tilt}deg) scale(${state.depth})`;
      rotation!.style.setProperty("--near-flip", String(state.flip));
      rotation!.style.setProperty("--near-blend", String(state.blend));
      scanLayer!.style.opacity = String(state.scan);
      reveal(eyebrow!, state.label, 12);
      reveal(title!, state.headline, 28);
      reveal(detail!, state.description, 20);
    }

    function schedule() {
      if (!scheduled) scheduled = requestAnimationFrame(render);
    }

    function measure() {
      if (disposed) return;
      headerHeight = header!.getBoundingClientRect().height;
      pinHeader();
      root!.style.setProperty("--near-nav-height", `${headerHeight}px`);
      const source = mark!.getBoundingClientRect();
      const frameBounds = frame!.getBoundingClientRect();
      initialSize = source.width;
      const finalBounds = destination!.getBoundingClientRect();
      finalSize = finalBounds.width;
      sourceCenterX = source.left + source.width / 2;
      finalCenterX = finalBounds.left + finalBounds.width / 2;
      finalCenter = parseFloat(getComputedStyle(destination!).top);
      pinCenter = Math.max(finalCenter, headerHeight + 24 + initialSize / 2);
      start = Math.max(0, source.top + window.scrollY + source.height / 2 - pinCenter);
      const top = root!.getBoundingClientRect().top + window.scrollY;
      release = Math.min(top + root!.offsetHeight - window.innerHeight, document.documentElement.scrollHeight - window.innerHeight);
      end = Math.max(start + 1, release - window.innerHeight * .12);
      floating!.style.width = `${initialSize}px`;
      floating!.style.height = `${source.height}px`;
      floating!.style.setProperty("--scan-frame-width", `${frameBounds.width}px`);
      floating!.style.setProperty("--scan-frame-height", `${frameBounds.height}px`);
      render();
    }

    root.dataset.enhanced = "true";
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(mark);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pageshow", measure);
    motion.addEventListener("change", measure);
    measure();
    void document.fonts.ready.then(measure);

    return () => {
      disposed = true;
      cancelAnimationFrame(scheduled);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      motion.removeEventListener("change", measure);
      Object.assign(header.style, savedHeader);
      hero.style.paddingTop = savedPadding;
      original.style.visibility = savedVisibility;
      delete root.dataset.enhanced;
    };
  }, [section, overlay, rotor, scan, settled, label, headline, description]);
  return { section, overlay, rotor, scan, settled, label, headline, description };
}
