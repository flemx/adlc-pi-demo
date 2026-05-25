"use client";

import * as React from "react";
import { slides, type SlideContext } from "./slides";

type Props = SlideContext;

export function SlideDeck(props: Props) {
  const [idx, setIdx] = React.useState(0);
  const total = slides.length;

  const go = React.useCallback((n: number) => {
    setIdx(((n % total) + total) % total);
  }, [total]);
  const next = React.useCallback(() => go(idx + 1), [go, idx]);
  const prev = React.useCallback(() => go(idx - 1), [go, idx]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, total]);

  const ctx = React.useMemo<SlideContext>(() => props, [props]);

  return (
    <div className="deck">
      <div className="slide-stage" role="region" aria-roledescription="slide deck" aria-label={slides[idx].label}>
        {slides.map((s, i) => (
          <section
            key={s.id}
            className={`slide ${i === idx ? "is-current" : i < idx ? "is-prev" : ""}`}
            aria-hidden={i !== idx}
          >
            {s.render(ctx)}
          </section>
        ))}
      </div>

      <div className="controls">
        <button className="btn" onClick={prev} aria-label="Previous slide">← Prev</button>

        <div className="progress">
          <div className="dot-nav" role="tablist">
            {slides.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={i === idx}
                aria-label={`Go to slide ${i + 1}: ${s.label}`}
                title={`${i + 1}. ${s.label}`}
                className={i === idx ? "active" : ""}
                onClick={() => go(i)}
              />
            ))}
          </div>
          <div className="counter">
            {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            <span className="muted mono"> · {slides[idx].label}</span>
          </div>
        </div>

        <button className="btn primary" onClick={next} aria-label="Next slide">
          {idx === total - 1 ? "Restart ↺" : "Next →"}
        </button>
      </div>
    </div>
  );
}
