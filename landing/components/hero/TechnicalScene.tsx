import { BrandMark } from "./BrandMark";

function TechnicalGrid() {
  return (
    <svg className="technical-grid" viewBox="0 0 1600 500" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <defs>
        <pattern id="technical-dots" width="56" height="56" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.8" fill="currentColor" /></pattern>
        <pattern id="technical-lines" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M12 4H46M4 12V46" stroke="currentColor" strokeWidth="1" /></pattern>
        <pattern id="technical-bars" width="6" height="36" patternUnits="userSpaceOnUse"><path d="M1 0v36" stroke="currentColor" /></pattern>
      </defs>
      <rect width="1600" height="500" fill="url(#technical-dots)" opacity=".2" />
      <rect x="780" width="820" height="500" fill="url(#technical-lines)" opacity=".16" />
      <g opacity=".18"><rect x="1190" y="69" width="56" height="36" fill="url(#technical-bars)" /><rect x="1302" y="349" width="56" height="36" fill="url(#technical-bars)" /><path d="M1358 224h56m-28-28v56M952 336h28m-14-14v28" /></g>
    </svg>
  );
}

export function TechnicalScene() {
  return (
    <div className="technical-scene" aria-label="PAKT logo with a scanning light">
      <TechnicalGrid />
      <div className="logo-frame">
        <div className="logo-frame__mark"><BrandMark prominent /></div>
        <div className="scan-window" aria-hidden="true"><div className="scan-beam" /></div>
        <div className="frame-detail" aria-hidden="true">
          <i className="corner corner--tl" /><i className="corner corner--tr" /><i className="corner corner--bl" /><i className="corner corner--br" />
          <i className="frame-cross frame-cross--tl" /><i className="frame-cross frame-cross--tr" /><i className="frame-cross frame-cross--bl" /><i className="frame-cross frame-cross--br" />
          <i className="frame-square frame-square--top" /><i className="frame-square frame-square--bottom" />
          <span className="side-marker side-marker--left"><i /><b /><i /></span>
          <span className="side-marker side-marker--right"><i /><b /><i /></span>
        </div>
      </div>
      <div className="edge-marker" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
    </div>
  );
}
