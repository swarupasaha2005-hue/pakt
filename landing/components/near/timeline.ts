export const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function smoothRange(start: number, end: number, value: number) {
  const progress = clamp((value - start) / (end - start));
  return progress * progress * (3 - 2 * progress);
}

export function fitRotation(angle: number, size: number, clearance: number, depth: number) {
  const radians = angle * Math.PI / 180;
  const radius = size * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))) / 2;
  return Math.min(depth, Math.max(0, clearance) / radius);
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
  const turn = smoothRange(.02, .98, crossing);
  return {
    morph: smoothRange(.24, .84, crossing),
    wash: 1 - .78 * smoothRange(0, .45, crossing),
    rotation: 360 * turn,
    depth: 1 - .06 * Math.sin(Math.PI * turn),
    scan: 1 - smoothRange(.16, .38, progress),
    label: smoothRange(.78, .88, progress),
    headline: smoothRange(.86, .98, progress),
    description: smoothRange(.9, 1, progress),
  };
}
