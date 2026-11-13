const COLUMNS = Array.from({ length: 6 }, (_, i) => 60 + i * 72);
const ROWS = Array.from({ length: 9 }, (_, i) => i * 72 + 2);

export function CollectiveGrid() {
  return (
    <div className="collective-grid">
      <svg viewBox="0 0 480 580" fill="none" aria-hidden="true">
        <g className="collective-grid__construction">
          {ROWS.map((y) => <g key={y}>
            {COLUMNS.map((x) => <g key={x}>
              <circle cx={x} cy={y} r="2.5" fill="currentColor" stroke="none" />
              <path d={`M${x - 59} ${y}h44${y < 578 ? ` M${x} ${y + 12}v44` : ""}`} />
            </g>)}
            <path d={`M432 ${y}h44`} />
          </g>)}
          {[300, 372].map((y) => <g key={y} opacity=".55">
            {Array.from({ length: 11 }, (_, i) => <path key={i} d={`M${282 + i * 7} ${y}v42`} />)}
          </g>)}
        </g>
        <g className="collective-grid__crosshairs">
          {[[204, 146], [276, 434], [132, 506]].map(([x, y]) => <path key={y} d={`M${x - 7} ${y}h14 M${x} ${y - 7}v14`} />)}
        </g>
      </svg>
      <p className="collective-grid__label"><span>[</span> PAKT <span>]</span></p>
    </div>
  );
}
