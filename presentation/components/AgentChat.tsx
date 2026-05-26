"use client";

import * as React from "react";
import { marked } from "marked";

export type AgentSummary = {
  id: string;
  label: string;
  developerName: string;
  description: string | null;
  agentType: string;
  activeVersion: number;
};

type ToolOutput = {
  type: string;
  value?: { outputPromptResponse?: string; [k: string]: any };
};

type ChatMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  toolOutputs?: ToolOutput[];
};

type Props = {
  agent: AgentSummary;
  /** Pre-fill input when an example utterance is sent in. */
  pendingInput?: string;
  /** Called once we've consumed the prefill so the parent can clear it. */
  onConsumedPending?: () => void;
};

/** Render markdown safely. marked v14 returns a string when async:false. */
function md(s: string): string {
  return marked.parse(s, { async: false }) as string;
}

/**
 * Convert the upstream `messages[]` from the session-start response into our
 * client-side ChatMessage shape. Each entry is typically an Inform / Inquire
 * shaped object with `id`, `message`, and an optional `result[]`.
 */
function mapWelcome(messages: any[] | undefined): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && typeof m.message === "string" && m.message.length > 0)
    .map((m, i) => ({
      id: m.id || `welcome-${i}`,
      role: "agent" as const,
      content: m.message as string,
      toolOutputs: Array.isArray(m.result) ? m.result : [],
    }));
}

export function AgentChat({ agent, pendingInput, onConsumedPending }: Props) {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [progress, setProgress] = React.useState<string | null>(null);
  const [streamingText, setStreamingText] = React.useState<string>("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [bootError, setBootError] = React.useState<string | null>(null);

  const seqRef = React.useRef(0);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // ── boot a session whenever the agent changes ───────────────────────────
  React.useEffect(() => {
    let cancelled = false;
    setSessionId(null);
    setMessages([]);
    setStreamingText("");
    setProgress(null);
    setError(null);
    setBootError(null);
    seqRef.current = 0;

    (async () => {
      try {
        const r = await fetch("/api/agents/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id }),
        });
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) {
          setBootError(
            data?.detail || data?.error || `Session start failed: ${r.status}`,
          );
          return;
        }
        setSessionId(data.sessionId);
        // The session response includes the agent's welcome message(s) in
        // `messages[]` (Inform / Inquire shaped). Surface them right away.
        const welcome = mapWelcome(data.messages);
        if (welcome.length) setMessages(welcome);
      } catch (err: any) {
        if (cancelled) return;
        setBootError(err?.message || "session start failed");
      }
    })();

    return () => { cancelled = true; };
  }, [agent.id]);

  // ── consume any prefill (from a slide test-utterance button) ────────────
  React.useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput);
      onConsumedPending?.();
    }
  }, [pendingInput, onConsumedPending]);

  // ── auto-scroll to bottom on any change ─────────────────────────────────
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, progress, streaming]);

  // ── send a message + parse the SSE stream ───────────────────────────────
  const send = React.useCallback(async (text: string) => {
    if (!sessionId || streaming) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    setStreaming(true);
    setStreamingText("");
    setProgress(null);

    seqRef.current += 1;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const r = await fetch("/api/agents/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          sequenceId: seqRef.current,
          text: trimmed,
        }),
        signal: ac.signal,
      });

      if (!r.ok || !r.body) {
        const ct = r.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const j = await r.json();
          if (j.sessionExpired) {
            setError("Session expired. Click ↻ Reset to start a new conversation.");
          } else {
            setError(j.detail || j.error || `HTTP ${r.status}`);
          }
        } else {
          setError(`HTTP ${r.status}`);
        }
        setStreaming(false);
        return;
      }

      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let validationFailed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines
        const frames = buf.split("\n\n");
        buf = frames.pop() || "";

        for (const frame of frames) {
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;

          let evt: any;
          try { evt = JSON.parse(json); } catch { continue; }
          const m = evt?.message;
          if (!m) continue;

          switch (m.type) {
            case "ProgressIndicator":
              setProgress(m.message || "Working…");
              break;
            case "TextChunk": {
              if (validationFailed) break;
              const off = m.offset ?? 0;
              const chunk = m.message ?? "";
              setStreamingText((prev) => (off === 0 ? chunk : prev + chunk));
              break;
            }
            case "ValidationFailureChunk": {
              validationFailed = true;
              const chunk = m.message ?? "";
              setStreamingText(chunk);
              break;
            }
            case "Inform":
            case "Inquire": {
              if (m.message) {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: m.id || `a-${Date.now()}`,
                    role: "agent",
                    content: m.message,
                    toolOutputs: m.result || [],
                  },
                ]);
              }
              setStreamingText("");
              setProgress(null);
              break;
            }
            case "EndOfTurn":
              setStreaming(false);
              setStreamingText("");
              setProgress(null);
              break;
            case "Error":
            case "Failure":
              setError(m.message || "Agent error");
              break;
            default:
              // unknown event — ignore for now
              break;
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err?.message || "stream failed");
      }
    } finally {
      setStreaming(false);
      setProgress(null);
    }
  }, [sessionId, streaming]);

  const reset = React.useCallback(async () => {
    abortRef.current?.abort();
    if (sessionId) {
      // best-effort end of session — ignore errors
      fetch(`/api/agents/message?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    setSessionId(null);
    setMessages([]);
    setStreamingText("");
    setProgress(null);
    setError(null);
    setBootError(null);
    seqRef.current = 0;

    // Restart immediately
    try {
      const r = await fetch("/api/agents/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setBootError(data?.detail || data?.error || `Session start failed: ${r.status}`);
        return;
      }
      setSessionId(data.sessionId);
      const welcome = mapWelcome(data.messages);
      if (welcome.length) setMessages(welcome);
    } catch (err: any) {
      setBootError(err?.message || "session start failed");
    }
  }, [agent.id, sessionId]);

  return (
    <div className="agent-chat">
      <header className="agent-chat-head">
        <div className="agent-chat-title">
          <div className="agent-chat-avatar" aria-hidden>✦</div>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--accent-hi)", letterSpacing: "0.12em" }}>
              {agent.agentType.replace(/Agent$/, "")} · v{agent.activeVersion}
            </div>
            <div className="agent-chat-name">{agent.label}</div>
          </div>
        </div>
        <div className="agent-chat-actions">
          <span className={`pill ${sessionId ? "" : "pill-muted"}`}>
            ● {sessionId ? "session live" : (bootError ? "session error" : "starting…")}
          </span>
          <button
            className="btn"
            onClick={reset}
            disabled={streaming}
            title="End the session and start a fresh one"
          >
            ↻ Reset
          </button>
        </div>
      </header>

      <div className="agent-chat-body" ref={scrollRef}>
        {bootError && (
          <div className="agent-chat-error">
            <b>Couldn't start a session.</b>
            <div className="mono" style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>{bootError}</div>
          </div>
        )}

        {!bootError && messages.length === 0 && !streamingText && !streaming && (
          <div className="agent-chat-empty">
            <div className="muted" style={{ fontSize: 13 }}>
              Say hello to <b>{agent.label}</b>. Try one of the example prompts from the Test slide.
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}

        {streamingText && (
          <Bubble
            message={{ id: "streaming", role: "agent", content: streamingText }}
            streaming
          />
        )}

        {streaming && !streamingText && (
          <div className="agent-chat-progress">
            <span className="dot-spin" />
            <span className="muted" style={{ fontSize: 12 }}>
              {progress ?? "Thinking…"}
            </span>
          </div>
        )}

        {error && (
          <div className="agent-chat-error">{error}</div>
        )}
      </div>

      <footer className="agent-chat-input">
        <textarea
          rows={2}
          placeholder={sessionId ? "Type a message and press ↵" : "Waiting for session…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          disabled={!sessionId || streaming}
        />
        <button
          className="btn primary"
          onClick={() => send(input)}
          disabled={!sessionId || streaming || !input.trim()}
        >
          Send
        </button>
      </footer>
    </div>
  );
}

function Bubble({
  message,
  streaming,
}: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`bubble-row ${isUser ? "bubble-row-user" : "bubble-row-agent"}`}>
      <div className={`bubble ${isUser ? "bubble-user" : "bubble-agent"}`}>
        {isUser ? (
          <div className="bubble-text">{message.content}</div>
        ) : (
          <>
            <div
              className="bubble-text md-body"
              dangerouslySetInnerHTML={{ __html: md(message.content) }}
            />
            {streaming && <span className="bubble-cursor" />}
            {!!message.toolOutputs?.length && (
              <ToolCards outputs={message.toolOutputs} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ToolCards({ outputs }: { outputs: ToolOutput[] }) {
  return (
    <div className="tool-cards">
      {outputs.map((t, i) => {
        const name = (t.type || "tool").replace(/^copilotActionOutput\//, "");
        const content =
          t.value?.outputPromptResponse ??
          (typeof t.value === "object"
            ? Object.values(t.value).find((v) => typeof v === "string") || JSON.stringify(t.value, null, 2)
            : String(t.value));
        const isHtml = /<[a-z][\s\S]*>/i.test(String(content));
        return (
          <div key={i} className="tool-card">
            <div className="tool-card-head mono">⚙ {name}</div>
            {isHtml ? (
              <div
                className="tool-card-body"
                dangerouslySetInnerHTML={{ __html: String(content) }}
              />
            ) : (
              <pre className="tool-card-body mono">{String(content)}</pre>
            )}
          </div>
        );
      })}
    </div>
  );
}
