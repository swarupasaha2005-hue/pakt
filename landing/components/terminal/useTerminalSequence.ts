"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TERMINAL_CARD_STEP, TERMINAL_DURATION, TERMINAL_ENTRANCE_DURATION, TERMINAL_EXIT_DURATION, TERMINAL_EXIT_START, TERMINAL_REVEAL } from "./timeline";

export function useTerminalSequence() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = section.current;
    const viewport = stage.current;
    const carrier = stack.current;
    const ribbon = strip.current;
    if (!root || !viewport || !carrier || !ribbon) return;
    gsap.registerPlugin(ScrollTrigger);
    const cards = Array.from(carrier.querySelectorAll<HTMLElement>(".terminal-card"));
    const backings = carrier.querySelectorAll<HTMLElement>(".terminal-backing");
    const media = gsap.matchMedia();
    let disposed = false;
    let refreshFrame = 0;

    function sizeBackings() {
      // Only reserve the visible stage through the band; its lower half is empty.
      root!.style.setProperty("--terminal-tail", `${(viewport!.offsetHeight + ribbon!.offsetHeight) / 2}px`);
      backings.forEach((backing) => { backing.style.height = `${cards[0].offsetHeight}px`; });
    }

    media.add({ motion: "(prefers-reduced-motion: no-preference)", compact: "(max-width: 760px)" }, (context) => {
      const { motion, compact } = context.conditions!;
      if (!motion) return;
      root.dataset.animated = "true";
      root.style.setProperty("--terminal-units", String(TERMINAL_DURATION));
      sizeBackings();
      gsap.set(carrier, { scale: .65, opacity: 0, y: 24, rotationX: 1.5, transformPerspective: 1400, transformOrigin: "center center" });
      gsap.set(cards, {
        xPercent: -50, yPercent: -50, x: 0,
        y: (index) => index * 7,
        rotation: (index) => (index % 2 ? 1 : -1) * (compact ? .8 : 1.5) * (index + 1),
        rotationY: (index) => (index % 2 ? 1 : -1) * (compact ? 1 : 2),
        opacity: (index) => index === 0 ? .06 : .015,
        force3D: true,
      });
      gsap.set(ribbon, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
      gsap.set(backings, { opacity: 1 });
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          id: "pakt-terminal-deck",
          trigger: root,
          start: "top top",
          end: () => `+=${root.offsetHeight - (viewport.offsetHeight + ribbon.offsetHeight) / 2}`,
          pin: viewport,
          pinSpacing: false,
          scrub: true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onRefreshInit: sizeBackings,
          onRefresh: sizeBackings,
          onUpdate: (self) => {
            root.dataset.activeCard = String(Math.min(cards.length - 1, Math.floor(Math.max(0, self.progress * TERMINAL_DURATION - TERMINAL_ENTRANCE_DURATION) / TERMINAL_CARD_STEP)) + 1);
            root.style.setProperty("--terminal-progress", String(self.progress));
          },
        },
      });
      timeline.fromTo(carrier, { scale: .65, opacity: 0, y: 24, rotationX: 1.5 }, {
        scale: 1, opacity: 1, y: 0, rotationX: 0,
        duration: TERMINAL_ENTRANCE_DURATION, ease: "sine.inOut", immediateRender: false,
      }, 0);
      cards.forEach((card, index) => {
        const at = TERMINAL_ENTRANCE_DURATION + index * TERMINAL_CARD_STEP;
        const direction = index % 2 ? 1 : -1;
        timeline.fromTo(card, {
          y: index * 7,
          rotation: direction * (compact ? .8 : 1.5) * (index + 1),
          rotationY: direction * (compact ? 1 : 2),
          opacity: index === 0 ? .06 : .015,
        }, {
          y: 0, rotation: 0, rotationY: 0, opacity: 1,
          duration: TERMINAL_REVEAL, ease: "sine.inOut", immediateRender: false,
        }, at);
        timeline.fromTo(card, { y: 0, rotation: 0, rotationY: 0 }, {
          y: () => -(window.innerHeight / 2 + card.offsetHeight / 2 + 60),
          rotation: direction * (compact ? 1.5 : 3),
          rotationY: -direction * (compact ? 1 : 2),
          duration: TERMINAL_EXIT_DURATION, ease: "sine.inOut", immediateRender: false,
        }, at + TERMINAL_EXIT_START);
      });
      timeline.fromTo(ribbon, { x: 0 }, {
        x: () => -viewport.clientWidth * .65,
        duration: TERMINAL_DURATION, immediateRender: false,
      }, 0);
      timeline.to(backings, { opacity: 0, duration: TERMINAL_EXIT_DURATION, ease: "sine.inOut" },
        TERMINAL_ENTRANCE_DURATION + (cards.length - 1) * TERMINAL_CARD_STEP + TERMINAL_EXIT_START);
      return () => {
        delete root.dataset.animated;
        root.style.removeProperty("--terminal-units");
        root.style.removeProperty("--terminal-tail");
      };
    }, root);

    function refresh() {
      refreshFrame = 0;
      if (!disposed) ScrollTrigger.refresh();
    }
    function scheduleRefresh() {
      if (!refreshFrame) refreshFrame = requestAnimationFrame(refresh);
    }
    const observer = new ResizeObserver(scheduleRefresh);
    [cards[0], document.querySelector(".editorial-section"), document.querySelector(".near-section"), document.querySelector(".hero-header")].forEach((node) => {
      if (node) observer.observe(node);
    });
    void document.fonts.ready.then(scheduleRefresh);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(refreshFrame);
      media.revert();
    };
  }, []);

  return { section, stage, stack, strip };
}
