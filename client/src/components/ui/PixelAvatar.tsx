const GRID = 8;

// fnv-1a, then xorshift: same seed → same face, no deps
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

/** colors + mirrored cells for a seed; shared with the share-card image */
export function sprite(seed: string) {
  const rand = rng(seed);
  const hue = Math.floor(rand() * 360);
  const bg = `hsl(${hue} 60% 22%)`;
  const fg = `hsl(${(hue + 40) % 360} 85% 62%)`;
  const cells: [number, number][] = [];
  // mirror left half → symmetric sprite
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID / 2; x++) if (rand() > 0.5) cells.push([x, y], [GRID - 1 - x, y]);
  return { bg, fg, cells, grid: GRID };
}

export function PixelAvatar({ seed }: { seed: string }) {
  const { bg, fg, cells } = sprite(seed);
  return (
    <svg aria-hidden viewBox={`0 0 ${GRID} ${GRID}`} shapeRendering="crispEdges" className="size-full rounded-full">
      <rect width={GRID} height={GRID} fill={bg} />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fg} />
      ))}
    </svg>
  );
}
