export const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function smoothRange(start: number, end: number, value: number) {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

export function nearTimeline(progress: number) {
  const flip = smoothRange(.43, .65, progress);
  return {
    flip,
    blend: smoothRange(.2, .8, flip),
    tilt: -14 * Math.sin(Math.PI * flip),
    depth: 1 - .06 * Math.sin(Math.PI * flip),
    settle: smoothRange(0, .35, progress),
    scan: 1 - smoothRange(.16, .38, progress),
    label: smoothRange(.78, .88, progress),
    headline: smoothRange(.86, .98, progress),
    description: smoothRange(.9, 1, progress),
  };
}
