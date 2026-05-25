"use client";

import * as React from "react";
import { SlideDeck } from "@/components/SlideDeck";
import { TerminalFrame } from "@/components/TerminalFrame";

type TabId = "slides" | "terminal";

export default function Home() {
  const [tab, setTab] = React.useState<TabId>("slides");

  const goToTerminal = React.useCallback(() => setTab("terminal"), []);
  const goToSlides   = React.useCallback(() => setTab("slides"), []);

  // Keyboard tab switching: 1 = slides, 2 = terminal, t = toggle
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "1") setTab("slides");
      else if (e.key === "2") setTab("terminal");
      else if (e.key.toLowerCase() === "t") setTab((p) => (p === "slides" ? "terminal" : "slides"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark" aria-hidden>✦</div>
          <div className="name">
            Headless 360 · <em>Agentforce vibe coding with sf-pi</em>
          </div>
        </div>

        <nav className="tabs" role="tablist" aria-label="Presentation sections">
          <button
            role="tab"
            aria-selected={tab === "slides"}
            className={`tab ${tab === "slides" ? "active" : ""}`}
            onClick={goToSlides}
          >
            <span aria-hidden>📊</span> Slides
            <span className="muted mono" style={{ fontSize: 10, marginLeft: 4 }}>1</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "terminal"}
            className={`tab ${tab === "terminal" ? "active" : ""}`}
            onClick={goToTerminal}
          >
            <span aria-hidden>⚡</span> Live demo
            <span className="badge">LIVE</span>
          </button>
        </nav>

        <div className="right">
          <span className="meta">Stockholm Breakout · <b>World Tour</b></span>
        </div>
      </header>

      <div className="stage">
        <div className={`panel ${tab === "slides" ? "active" : ""}`}>
          <SlideDeck goToTerminal={goToTerminal} />
        </div>
        <div className={`panel ${tab === "terminal" ? "active" : ""}`}>
          <TerminalFrame active={tab === "terminal"} />
        </div>
      </div>
    </main>
  );
}
