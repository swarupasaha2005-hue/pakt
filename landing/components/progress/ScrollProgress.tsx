"use client";

import { useLandingProgress } from "./useLandingProgress";
import "./scroll-progress.css";

export function ScrollProgress() {
  const indicator = useLandingProgress();
  return (
    <div ref={indicator} className="landing-progress" role="progressbar" aria-label="Page progress" aria-valuemin={1} aria-valuemax={6} aria-valuenow={1} aria-valuetext="Introduction">
      <div className="landing-progress__blocks" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <span key={index} className="landing-progress__block" data-active={index === 0} />)}
      </div>
    </div>
  );
}
