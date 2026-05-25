"use client";

import * as React from "react";

export type TerminalHandle = {
  /** Type a command at the shell prompt and press Enter. */
  runCommand: (command: string) => void;
  /** Send a Ctrl-C to the PTY. */
  interrupt: () => void;
  /** Tear down and remount the iframe (fresh shell session). */
  reset: () => void;
};

type Props = { active: boolean };

/**
 * Embeds the standalone ghostty-web terminal page (public/terminal.html) in
 * an iframe. The terminal connects to /ws on the same origin, where the
 * custom Next.js server brokers a node-pty session.
 *
 * postMessage protocol with public/terminal.html:
 *   parent → frame : { type: 'run', cmd }     type cmd + Enter
 *   parent → frame : { type: 'interrupt' }    send Ctrl-C
 *   frame → parent : { type: 'ready' }        WS open & terminal ready
 */
export const TerminalFrame = React.forwardRef<TerminalHandle, Props>(function TerminalFrame(
  { active },
  ref,
) {
  const [mounted, setMounted] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  // Queued action while the iframe is still booting up.
  const pendingRef = React.useRef<{ type: string; cmd?: string } | null>(null);

  // Mount the iframe lazily on first activation.
  React.useEffect(() => {
    if (active && !mounted) setMounted(true);
  }, [active, mounted]);

  // Listen for the iframe's "ready" handshake and flush a queued action.
  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ready") {
        setReady(true);
        const pend = pendingRef.current;
        if (pend && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(pend, window.location.origin);
          pendingRef.current = null;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const dispatch = React.useCallback((msg: { type: string; cmd?: string }) => {
    if (ready && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, window.location.origin);
    } else {
      pendingRef.current = msg;
      setMounted(true);
    }
  }, [ready]);

  React.useImperativeHandle(ref, () => ({
    runCommand: (cmd: string) => dispatch({ type: "run", cmd }),
    interrupt: () => dispatch({ type: "interrupt" }),
    reset: () => {
      setReady(false);
      pendingRef.current = null;
      setReloadKey((k) => k + 1);
    },
  }), [dispatch]);

  return (
    <div className="term-panel">
      <div className="term-head">
        <h2>Live demo</h2>
        <span className={`pill ${ready ? "" : "pill-muted"}`}>
          ● {ready ? "ws://localhost/ws → pty" : "connecting…"}
        </span>
        <span className="path">cwd: agentforce/</span>
        <div className="actions">
          <button
            className="btn primary"
            onClick={() => dispatch({ type: "run", cmd: "pi" })}
            disabled={!ready}
            title="Type 'pi' at the shell prompt to start an interactive session"
          >
            ▶ Start pi agent
          </button>
          <button
            className="btn"
            onClick={() => {
              setReady(false);
              pendingRef.current = null;
              setReloadKey((k) => k + 1);
            }}
            title="Restart the shell session"
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
            ref={iframeRef}
            src="/terminal.html"
            title="pi live terminal"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="term-empty">
            <div>
              <div className="muted">terminal mounts on first open</div>
              <button className="btn primary" onClick={() => setMounted(true)} style={{ marginTop: 14 }}>
                ⚡ Connect now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
