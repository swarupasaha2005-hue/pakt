/** ▲/▼ + abs percent in --up/--down; 0 = neutral */
export function Pct({ value, className = "" }: { value: number; className?: string }) {
  const color = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-text-2";
  return (
    <span className={`inline-flex items-center gap-1 ${color} ${className}`}>
      {value !== 0 && <span className="text-[0.6em]">{value > 0 ? "▲" : "▼"}</span>}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}
