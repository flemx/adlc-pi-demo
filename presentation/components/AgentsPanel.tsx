"use client";

import * as React from "react";
import { AgentChat, type AgentSummary } from "./AgentChat";

type Props = {
  active: boolean;
  /** Optional pre-fill set by the Test slide's "→ Send to chat" button. */
  pendingUtterance?: string;
  onConsumedUtterance?: () => void;
  /** Optional pre-selected agent api name (e.g. set by a slide). */
  preferredDeveloperName?: string;
};

type ListResp =
  | { ok: true; agents: AgentSummary[]; instanceUrl?: string; targetOrg?: string }
  | { ok: false; error: string; detail?: string; hint?: string; missing?: string[]; targetOrg?: string };

export function AgentsPanel({
  active,
  pendingUtterance,
  onConsumedUtterance,
  preferredDeveloperName,
}: Props) {
  const [resp, setResp] = React.useState<ListResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<AgentSummary | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/agents", { cache: "no-store" });
      const data = (await r.json()) as ListResp;
      setResp(data);
      if (data.ok) {
        setSelected((prev) => {
          if (prev) {
            // keep current selection if it still exists
            const same = data.agents.find((a) => a.id === prev.id);
            if (same) return same;
          }
          if (preferredDeveloperName) {
            const match = data.agents.find((a) => a.developerName === preferredDeveloperName);
            if (match) return match;
          }
          return data.agents[0] ?? null;
        });
      }
    } catch (err: any) {
      setResp({ ok: false, error: err?.message || "list failed" });
    } finally {
      setLoading(false);
    }
  }, [preferredDeveloperName]);

  // Lazy-load on first activation (and reload every time the tab regains focus
  // is overkill — explicit ↺ Refresh button covers it).
  React.useEffect(() => {
    if (!active || resp || loading) return;
    reload();
  }, [active, resp, loading, reload]);

  return (
    <div className="agents-panel">
      <header className="agents-head">
        <h2>Service agents</h2>
        <span className="path mono">
          {resp && resp.ok ? `${resp.agents.length} active` : "—"}
        </span>
        <div className="actions">
          <button
            className="btn"
            onClick={reload}
            disabled={loading}
            title="Re-query the org for active agents"
          >
            {loading ? "…" : "↺ Refresh"}
          </button>
        </div>
      </header>

      <div className="agents-body">
        <aside className="agents-list">
          {!resp && loading && <ListSkeleton />}
          {resp && !resp.ok && <ConfigEmpty resp={resp} />}
          {resp && resp.ok && resp.agents.length === 0 && (
            <div className="agents-empty">
              <div className="muted">
                No active service agents in this org yet. Run the Build phase
                to publish one.
              </div>
            </div>
          )}
          {resp && resp.ok && resp.agents.length > 0 && (
            <ul className="agents-ul">
              {resp.agents.map((a) => (
                <li
                  key={a.id}
                  className={`agent-row ${selected?.id === a.id ? "sel" : ""}`}
                  onClick={() => setSelected(a)}
                >
                  <div className="agent-row-head">
                    <span className="agent-row-icon" aria-hidden>✦</span>
                    <div className="agent-row-name">{a.label}</div>
                    <span className={`pill mono ${a.activeVersion > 0 ? "pill-blue" : "pill-muted"}`}>
                      {a.activeVersion > 0 ? `v${a.activeVersion}` : "v?"}
                    </span>
                  </div>
                  <div className="agent-row-meta mono">{a.developerName}</div>
                  {a.description && (
                    <div className="agent-row-desc">{a.description}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="agents-chat">
          {selected ? (
            <AgentChat
              key={selected.id}
              agent={selected}
              pendingInput={pendingUtterance}
              onConsumedPending={onConsumedUtterance}
            />
          ) : (
            <div className="agents-chat-empty">
              <div>
                <div className="eyebrow"><span className="pulse" /> Pick an agent</div>
                <h3 style={{ marginTop: 12, color: "var(--fg-0)" }}>
                  Click an agent on the left to start chatting.
                </h3>
                <p className="muted" style={{ marginTop: 8, maxWidth: 540 }}>
                  This pane talks to the live AgentForce conversational API.
                  Each new session is real \u2014 same as the chat widget your
                  customers would see.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="agents-skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="agents-skeleton-row" />
      ))}
    </div>
  );
}

function ConfigEmpty({
  resp,
}: { resp: { error: string; detail?: string; hint?: string; missing?: string[] } }) {
  const isConfigMiss = !!resp.missing?.length;
  return (
    <div className="agents-empty">
      <div className="agents-empty-icon">⚠</div>
      <div className="agents-empty-title">
        {isConfigMiss ? "Connected app not configured" : "Couldn't load agents"}
      </div>
      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        {resp.error}
      </div>
      {resp.detail && (
        <pre className="mono agents-env-snippet" style={{ marginTop: 10 }}>{resp.detail}</pre>
      )}
      {resp.hint && (
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>{resp.hint}</div>
      )}
      {isConfigMiss && (
        <pre className="mono agents-env-snippet">{`# presentation/.env.local
${resp.missing!.map((k) => `${k}=`).join("\n")}`}</pre>
      )}
    </div>
  );
}
