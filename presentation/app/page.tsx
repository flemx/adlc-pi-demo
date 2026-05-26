"use client";

import * as React from "react";
import { SlideDeck } from "@/components/SlideDeck";
import { TerminalFrame, type TerminalHandle } from "@/components/TerminalFrame";
import { Planning } from "@/components/Planning";
import { AgentsPanel } from "@/components/AgentsPanel";

type TabId = "slides" | "planning" | "agents" | "terminal";

const TAB_ORDER: TabId[] = ["slides", "planning", "agents", "terminal"];

export default function Home() {
  const [tab, setTab] = React.useState<TabId>("slides");
  const terminalRef = React.useRef<TerminalHandle | null>(null);

  const goToSlides   = React.useCallback(() => setTab("slides"), []);
  const goToPlanning = React.useCallback(() => setTab("planning"), []);
  const goToAgents   = React.useCallback(() => setTab("agents"), []);
  const goToTerminal = React.useCallback(() => setTab("terminal"), []);

  /**
   * Switch to the Live demo tab and run `pi "<prompt>"` at the shell prompt.
   * pi accepts the prompt as argv and starts an interactive session pre-filled
   * with that message — same as a presenter typing it.
   */
  const runInPi = React.useCallback((prompt: string) => {
    setTab("terminal");
    const cmd = `pi ${shellQuote(prompt)}`;
    requestAnimationFrame(() => {
      terminalRef.current?.runCommand(cmd);
    });
  }, []);

  // Keyboard tab switching: 1/2/3/4, t to cycle.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "1") setTab("slides");
      else if (e.key === "2") setTab("planning");
      else if (e.key === "3") setTab("agents");
      else if (e.key === "4") setTab("terminal");
      else if (e.key.toLowerCase() === "t") {
        setTab((p) => TAB_ORDER[(TAB_ORDER.indexOf(p) + 1) % TAB_ORDER.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-logo"
            src="/images/salesforce-logo.png"
            alt="Salesforce"
          />
          <div className="name">
            Headless 360 · <em>Agentforce vibe coding with sf-pi</em>
          </div>
        </div>

        <nav className="tabs" role="tablist" aria-label="Presentation sections">
          <TabButton id="slides"   tab={tab} onClick={goToSlides}>📊 Slides</TabButton>
          <TabButton id="planning" tab={tab} onClick={goToPlanning}>📁 Planning</TabButton>
          <TabButton id="agents"   tab={tab} onClick={goToAgents}>✦ Agents</TabButton>
          <TabButton id="terminal" tab={tab} onClick={goToTerminal}>
            ⚡ Live demo <span className="badge">pi</span>
          </TabButton>
        </nav>

        <div className="right">
          <span className="meta">Stockholm Breakout · <b>World Tour</b></span>
        </div>
      </header>

      <div className="stage">
        <div className={`panel ${tab === "slides"   ? "active" : ""}`}>
          <SlideDeck
            goToTerminal={goToTerminal}
            goToPlanning={goToPlanning}
            goToAgents={goToAgents}
            runInPi={runInPi}
          />
        </div>
        <div className={`panel ${tab === "planning" ? "active" : ""}`}>
          <Planning active={tab === "planning"} />
        </div>
        <div className={`panel ${tab === "agents"   ? "active" : ""}`}>
          <AgentsPanel active={tab === "agents"} />
        </div>
        <div className={`panel ${tab === "terminal" ? "active" : ""}`}>
          <TerminalFrame ref={terminalRef} active={tab === "terminal"} />
        </div>
      </div>
    </main>
  );
}

function TabButton({
  id, tab, onClick, children,
}: {
  id: TabId;
  tab: TabId;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const idx = TAB_ORDER.indexOf(id) + 1;
  return (
    <button
      role="tab"
      aria-selected={tab === id}
      className={`tab ${tab === id ? "active" : ""}`}
      onClick={onClick}
    >
      {children}
      <span className="muted mono" style={{ fontSize: 10, marginLeft: 6 }}>{idx}</span>
    </button>
  );
}

/** POSIX single-quote escape: ' → '\'' so multi-line prompts survive the shell verbatim. */
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
