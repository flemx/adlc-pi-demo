"use client";

import * as React from "react";

type Props = { active: boolean };

/**
 * Embeds the standalone ghostty-web terminal page (public/terminal.html) in
 * an iframe. The terminal connects to /ws on the same origin, where the
 * custom Next.js server brokers a node-pty session running `pi` in the
 * SFDX project root.
 *
 * The iframe is mounted lazily on first activation (so the WS connection
 * isn't established before the audience has reached the demo tab).
 */
export function TerminalFrame({ active }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  return (
    <div className="term-panel">
      <div className="term-head">
        <h2>Live demo</h2>
        <span className="pill">● ws://localhost/ws → pi</span>
        <span className="path">cwd: agentforce/</span>
        <div className="actions">
          <button
            className="btn"
            onClick={() => setReloadKey((k) => k + 1)}
            title="Restart the pi session"
          >
            ↺ Restart
          </button>
          <a className="btn" href="/terminal.html" target="_blank" rel="noreferrer">
            ↗ Pop out
          </a>
        </div>
      </div>

      <div className="term-frame">
        {mounted ? (
          <iframe
            key={reloadKey}
            src="/terminal.html"
            title="pi live terminal"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--fg-3)" }}>
            terminal will mount when the tab opens…
          </div>
        )}
      </div>
    </div>
  );
}
