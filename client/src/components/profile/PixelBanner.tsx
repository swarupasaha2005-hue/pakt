const W = 48;
const H = 8;

// same fnv-1a + xorshift as ui/PixelAvatar, so the first draw (hue) matches the avatar
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

/** deterministic cover from the account id, in the avatar's palette */
export function PixelBanner({ seed }: { seed: string }) {
  const rand = rng(seed);
  const hue = Math.floor(rand() * 360);
  const cells: [number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W / 2; x++) if (rand() > 0.7) cells.push([x, y], [W - 1 - x, y]);

  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" className="size-full rounded-xl">
      <rect width={W} height={H} fill={`hsl(${hue} 60% 22%)`} />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={`hsl(${(hue + 40) % 360} 85% 62%)`} opacity={0.35} />
      ))}
    </svg>
  );
}
