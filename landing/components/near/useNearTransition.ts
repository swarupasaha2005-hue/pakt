"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { logoPosition, NEAR_TIMELINE_DURATION } from "./timeline";

export function useNearTransition() {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const section = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const rotor = useRef<HTMLDivElement>(null);
  const scan = useRef<HTMLDivElement>(null);
  const settled = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const description = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    if (!mounted) return;
    const root = section.current;
    const floating = overlay.current;
    const rotation = rotor.current;
    const scanLayer = scan.current;
    const destination = settled.current;
    const title = headline.current;
    const detail = description.current;
    const hero = document.querySelector<HTMLElement>(".landing-hero");
    const header = hero?.querySelector<HTMLElement>(".hero-header");
    const mark = hero?.querySelector<HTMLElement>(".brand-mark--hero");
    const original = hero?.querySelector<HTMLElement>(".logo-frame__mark");
    const frame = hero?.querySelector<HTMLElement>(".logo-frame");
    if (!root || !floating || !rotation || !scanLayer || !destination || !title || !detail || !hero || !header || !mark || !original || !frame) return;
    gsap.registerPlugin(ScrollTrigger);

    const savedHeader = { position: header.style.position, top: header.style.top, left: header.style.left, right: header.style.right };
    const savedPadding = hero.style.paddingTop;
    const savedVisibility = original.style.visibility;
    const savedLoopState = destination.dataset.loopActive;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let flip: gsap.core.Timeline | undefined;
    let scheduled = 0;
    let disposed = false;
    let start = 0, end = 1, flipEnd = 1, release = 1;
    let initialSize = 0, finalSize = 0, pinCenter = 0, finalCenter = 0;
    let sourceCenterX = 0, finalCenterX = 0;
    let headerHeight = 0, boundary = 0, drop = 0;

    function pinHeader() {
      if (window.scrollY > 0) {
        hero!.style.paddingTop = `${headerHeight}px`;
        Object.assign(header!.style, { position: "fixed", top: "0px", left: "0px", right: "0px" });
      } else {
        hero!.style.paddingTop = savedPadding;
        Object.assign(header!.style, savedHeader);
      }
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
      root!.style.setProperty("--near-progress", String(flip?.progress() ?? 0));
      if (motion.matches) {
        original!.style.visibility = savedVisibility;
        floating!.style.display = "none";
        floating!.style.visibility = "hidden";
        destination!.style.visibility = "visible";
        destination!.dataset.loopActive = "false";
        [title!, detail!].forEach((node) => { node.style.opacity = "1"; node.style.transform = "none"; });
        return;
      }
      const position = logoPosition(y, { start, boundary, center: pinCenter, drop, initialSize, finalSize, finalCenter, settleDistance: window.innerHeight * .28 });
      const complete = y >= flipEnd && (flip?.time() ?? 0) >= 1 - .00001 && position.settle >= .999;
      const loopActive = complete && (flip?.time() ?? 0) >= NEAR_TIMELINE_DURATION - .00001 && root!.getBoundingClientRect().bottom > 0;
      const showingTransition = y >= start && y < release && !complete;
      if (destination!.dataset.loopActive === "true" && !loopActive) {
        destination!.querySelectorAll(".near-loop-rotor").forEach((node) => {
          const animation = node.getAnimations()[0];
          if (animation) animation.currentTime = 0;
        });
      }
      destination!.dataset.loopActive = String(loopActive);
      const entering = showingTransition && floating!.style.display !== "block";
      floating!.style.display = showingTransition ? "block" : "none";
      floating!.style.visibility = showingTransition ? "visible" : "hidden";
      if (entering) synchronizeScan();
      original!.style.visibility = showingTransition ? "hidden" : savedVisibility;
      destination!.style.visibility = complete || y >= release ? "visible" : "hidden";
      const centerX = sourceCenterX + (finalCenterX - sourceCenterX) * position.settle;
      floating!.style.transform = `translate3d(${centerX - initialSize / 2}px, ${position.center - initialSize / 2}px, 0) scale(${position.size / initialSize})`;
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
      const finalBounds = destination!.getBoundingClientRect();
      initialSize = source.width;
      finalSize = finalBounds.width;
      sourceCenterX = source.left + source.width / 2;
      finalCenterX = finalBounds.left + finalBounds.width / 2;
      finalCenter = parseFloat(getComputedStyle(destination!).top);
      pinCenter = Math.max(finalCenter, headerHeight + 24 + initialSize / 2);
      start = Math.max(0, source.top + window.scrollY + source.height / 2 - pinCenter);
      boundary = root!.getBoundingClientRect().top + window.scrollY;
      drop = Math.max(0, Math.min(window.innerHeight * .1, 96, window.innerHeight - 24 - initialSize / 2 - pinCenter));
      release = boundary + root!.offsetHeight - window.innerHeight;
      flipEnd = Math.max(boundary + window.innerHeight * .08, start + window.innerHeight * .65);
      end = start + (flipEnd - start) * NEAR_TIMELINE_DURATION;
      floating!.style.width = `${initialSize}px`;
      floating!.style.height = `${source.height}px`;
      floating!.style.setProperty("--scan-frame-width", `${frameBounds.width}px`);
      floating!.style.setProperty("--scan-frame-height", `${frameBounds.height}px`);
      flip?.scrollTrigger?.refresh();
      render();
    }

    root.dataset.enhanced = "true";
    measure();
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      measure();
      flip = gsap.timeline({
        scrollTrigger: {
          id: "pakt-near-flip", trigger: root,
          start: () => start, end: () => end,
          scrub: true, invalidateOnRefresh: true,
          onUpdate: render, onRefresh: render,
        },
      });
      flip.fromTo(rotation, { rotationY: 0 }, { rotationY: 180, duration: 1, ease: "none" }, 0);
      flip.fromTo(scanLayer, { opacity: 1 }, { opacity: 0, duration: .28, ease: "none" }, .12);
      flip.fromTo(title, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: .18, ease: "power1.out" }, .8);
      flip.fromTo(detail, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .2, ease: "power1.out" }, .84);
      render();
      return () => { flip = undefined; };
    }, root);

    const observer = new ResizeObserver(measure);
    [header, mark, root].forEach((node) => observer.observe(node));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pageshow", measure);
    motion.addEventListener("change", measure);
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      cancelAnimationFrame(scheduled);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", measure);
      motion.removeEventListener("change", measure);
      media.revert();
      Object.assign(header.style, savedHeader);
      hero.style.paddingTop = savedPadding;
      original.style.visibility = savedVisibility;
      if (savedLoopState === undefined) delete destination.dataset.loopActive;
      else destination.dataset.loopActive = savedLoopState;
      delete root.dataset.enhanced;
    };
  }, [mounted]);

  return { section, overlay, rotor, scan, settled, headline, description, mounted };
}
