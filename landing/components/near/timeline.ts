export const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function smoothRange(start: number, end: number, value: number) {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

export type LogoTrack = {
  start: number;
  boundary: number;
  center: number;
  drop: number;
  initialSize: number;
  finalSize: number;
  finalCenter: number;
  settleDistance: number;
};

export function logoPosition(scroll: number, track: LogoTrack) {
  const crossingCenter = Math.max(track.start + 1, track.boundary - track.center - track.drop);
  const crossingEnd = crossingCenter + track.initialSize / 2;
  const descent = smoothRange(track.start, crossingCenter, scroll);
  const settle = smoothRange(crossingEnd, crossingEnd + track.settleDistance, scroll);
  const center = track.center + track.drop * descent + (track.finalCenter - track.center - track.drop) * settle;
  const size = track.initialSize + (track.finalSize - track.initialSize) * settle;
  const cut = (track.boundary - scroll - center + size / 2) / size;
  return { center, size, cut, crossing: clamp(1 - cut), settle };
}

export function nearTimeline(progress: number, crossing: number) {
  const turn = smoothRange(.32, .94, crossing);
  const rotation = Math.sin(Math.PI * turn);
  return {
    morph: smoothRange(.24, .84, crossing),
    wash: 1 - .78 * smoothRange(0, .45, crossing),
    yaw: -65 * rotation,
    tilt: -28 * rotation,
    depth: 1 - .06 * rotation,
    scan: 1 - smoothRange(.16, .38, progress),
    label: smoothRange(.78, .88, progress),
    headline: smoothRange(.86, .98, progress),
    description: smoothRange(.9, 1, progress),
  };
}
