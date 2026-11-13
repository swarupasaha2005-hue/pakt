import type { CSSProperties } from "react";

const CLUSTERS = [
  [4, 15, 3, "mint"], [10, 39, 4, "teal"], [17, 22, 1, "mint"],
  [25, 51, 4, "charcoal"], [32, 12, 2, "teal"], [34, 71, 1, "mint"],
  [67, 21, 3, "charcoal"], [75, 43, 1, "teal"], [83, 15, 4, "mint"],
  [91, 55, 3, "teal"], [96, 31, 1, "mint"], [69, 76, 2, "teal"],
  [7, 83, 2, "teal"], [14, 62, 3, "mint"], [21, 92, 1, "charcoal"],
  [29, 31, 2, "mint"], [38, 48, 5, "teal"], [43, 84, 3, "charcoal"],
  [48, 18, 1, "mint"], [53, 67, 4, "teal"], [59, 38, 2, "charcoal"],
  [63, 91, 1, "mint"], [72, 8, 3, "teal"], [78, 63, 5, "mint"],
  [86, 86, 2, "charcoal"], [94, 10, 3, "teal"], [2, 48, 1, "mint"],
  [19, 6, 4, "charcoal"], [45, 57, 2, "mint"], [88, 39, 1, "teal"],
] as const;

export function PixelField() {
  return <div className="near-pixels" aria-hidden="true">
    {CLUSTERS.map(([x, y, count, color], index) => (
      <span key={index} className="near-pixel-cluster" style={{ left: `${x}%`, top: `${y}%`, "--pixel-color": `var(--${color})`, "--pixel-duration": `${20 + (index * 7) % 13}s`, "--pixel-delay": `${-((index * 11) % 29)}s` } as CSSProperties}>
        {Array.from({ length: count }, (_, pixel) => <i key={pixel} style={{ opacity: .12 + ((pixel + index) % 4) * .1 }} />)}
      </span>
    ))}
  </div>;
}
