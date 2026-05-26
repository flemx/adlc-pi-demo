import * as React from "react";
import { PixelAstro } from "./PixelAstro";

export type SlideContext = {
  goToTerminal: () => void;
  goToPlanning: () => void;
  goToAgents: () => void;
  runInPi: (prompt: string) => void;
};

/** Salesforce org Cases list URL — opened in a new tab from the Plan slide. */
export const ORG_CASES_URL =
  "https://orgfarm-22ccc7c65d.lightning.force.com/lightning/o/Case/list?filterName=AllOpenCases";

/**
 * Salesforce Cases list view (Lightning) and the Agentforce Studio Agents page
 * — these get linked from the Plan and Test slides respectively.
 */
export const AGENTFORCE_STUDIO_URL =
  "https://orgfarm-22ccc7c65d.lightning.force.com/lightning/n/standard-AgentforceStudio?c__nav=agents";

/**
 * Test utterances rendered on the Test slide. Each one references a Case by
 * its human-readable Case Number (e.g. 00001001), not the 18-char record id
 * — that's what a real customer would type in chat. The agent's actions
 * resolve the Case via SOQL on CaseNumber.
 *
 * Edit these to match real Case Numbers from the demo org before going live.
 */
export const TEST_UTTERANCES: { label: string; text: string; caseNumber: string; email: string }[] = [
  {
    label: "Status check",
    caseNumber: "00001001",
    email: "alice@example.com",
    text:
      "Hi, I'd like a status update on case 00001001. The customer is alice@example.com — please look it up and let her know where things stand.",
  },
  {
    label: "Apologise + acknowledge",
    caseNumber: "00001002",
    email: "bob@example.com",
    text:
      "Please acknowledge case 00001002 for bob@example.com. Apologise for the wait and confirm we're working on it.",
  },
  {
    label: "Apply credit",
    caseNumber: "00001003",
    email: "carol@example.com",
    text:
      "Apply a goodwill credit on case 00001003 for carol@example.com — small amount, with a polite confirmation reply.",
  },
];

export type Slide = {
  id: string;
  label: string;       // shown in dot-nav tooltip
  render: (ctx: SlideContext) => React.ReactNode;
};

// ── prompts ────────────────────────────────────────────────────────────────

export const PLAN_PROMPT = `Read the 5 most recent Cases from the default org and propose ONE Agentforce service agent that would deflect the most of them.

Steps:
1. Pull the 5 newest Cases via sf data query (Subject, Description, Status, Priority, Account.Name).
2. Find the common themes across them.
3. Design ONE service agent in enough detail that we can scaffold it next:
   - Topic name + which Cases it handles
   - 1–2 actions — for each: action name, inputs, what it returns
   - The reply the agent sends back to the customer
   - Success metric (what counts as a deflection)
4. Save a SHORT HTML report at planning/case-deflection-plan.html — keep it concise so it generates quickly. Dark theme, Salesforce blue, inline CSS. Include a simple HTML/CSS diagram of the agent: a topic box on top with the 1–2 action boxes below it, connected with a thin line. Use flexbox + border-radius, no SVG.

Read-only — no DML, no deploy.`;

/**
 * PLAN_PROMPT, but with `**word**` markers around the bits we want to highlight
 * when shown to a live audience. The markers are stripped before the prompt is
 * sent to pi or copied. Keep this in lock-step with PLAN_PROMPT — same words,
 * just wrapped.
 */
const PLAN_PROMPT_DISPLAY = `Read the **5 most recent Cases** from the default org and propose **ONE Agentforce service agent** that would deflect the most of them.

Steps:
1. Pull the 5 newest Cases via **sf data query** (Subject, Description, Status, Priority, Account.Name).
2. Find the **common themes** across them.
3. Design **ONE service agent** in enough detail that we can **scaffold it next**:
   - **Topic name** + which Cases it handles
   - **1–2 actions** — for each: **action name**, **inputs**, **what it returns**
   - The **reply** the agent sends back to the customer
   - **Success metric** (what counts as a deflection)
4. Save a **short HTML report** at **planning/case-deflection-plan.html** — keep it **concise** so it generates quickly. Dark theme, Salesforce blue, inline CSS. Include a **simple HTML/CSS diagram** of the agent: a topic box on top with the 1–2 action boxes below it, connected with a thin line. Use **flexbox + border-radius, no SVG**.

**Read-only** — no DML, no deploy.`;

export const BUILD_PROMPT = `You are sf-pi. Build the Agentforce agent described in planning/case-deflection-plan.html. Keep it tiny.

Steps:
1. Read planning/case-deflection-plan.html for the agent design.
2. Write TWO stub Apex @InvocableMethod actions.
3. Deploy both Apex classes in a single sf project deploy call.
4. Use /agentscript_authoring skill to create the agent bundle: EXACTLY ONE subagent that calls BOTH actions. That single subagent IS the start_agent .
5. The subagent's reasoning instructions end with a self-contained HTML reply card (inline CSS, dark theme, Salesforce-blue accent).
6. Validate, then publish + activate. Do NOT run preview or eval — that's the next phase.

When done, print ONE line: agent api name · version · activation status · path to each Apex class.`;

/**
 * BUILD_PROMPT, with `**word**` markers around the audience-visible highlights.
 * Stripped before the prompt is sent to pi or copied. Keep in lock-step.
 */
const BUILD_PROMPT_DISPLAY = `You are **sf-pi**. Build the Agentforce agent described in **planning/case-deflection-plan.html**. Keep it tiny.

Steps:
1. Read **planning/case-deflection-plan.html** for the agent design.
2. Write TWO stub Apex @InvocableMethod actions.
3. **Deploy both Apex classes** in a single **sf project deploy** call.
4. Use **/agentscript_authoring** skill to create the agent bundle: EXACTLY ONE subagent that calls BOTH actions. That single subagent IS the start_agent.
5. The subagent's reasoning instructions end with a **self-contained HTML reply card** (inline CSS, dark theme, Salesforce-blue accent).
6. **Validate**, then **publish + activate**. Do NOT run **preview or eval** — that's the next phase.

When done, print **ONE line**: agent api name · version · activation status · path to each Apex class.`;

// ── prompt block UI ────────────────────────────────────────────────────────

/**
 * Renders a string with `**word**` segments turned into highlighted spans.
 * Lightweight on purpose — not full markdown.
 */
function renderHighlighted(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    return m ? <mark key={i} className="hl">{m[1]}</mark> : <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function PromptBlock({
  prompt,
  display,
  onRun,
  label = "Run in pi",
  hint,
  extra,
}: {
  /** Raw prompt text — sent to pi and copied to clipboard. */
  prompt: string;
  /** Optional formatted version (with `**...**` highlights) shown to the audience. */
  display?: string;
  onRun: (p: string) => void;
  label?: string;
  hint?: string;
  /** Optional extra content rendered next to the action buttons (e.g. an external link). */
  extra?: React.ReactNode;
}) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <div className="prompt">
      <div className="prompt-head">
        <span className="chip"><b>prompt for pi</b></span>
        {hint && <span className="muted" style={{ fontSize: 12 }}>{hint}</span>}
        <div className="prompt-actions">
          {extra}
          <button className="btn" onClick={onCopy}>
            {copied ? "✓ Copied" : "⧉ Copy prompt"}
          </button>
          <button className="btn primary" onClick={() => onRun(prompt)}>
            ⚡ {label}
          </button>
        </div>
      </div>
      <pre className="prompt-body mono">{display ? renderHighlighted(display) : prompt}</pre>
      <div className="prompt-foot mono">
        <span className="muted">$</span>{" "}
        <span className="prompt-cmd">pi</span>{" "}
        <span className="muted">"…"</span>
      </div>
    </div>
  );
}

// ── slides ─────────────────────────────────────────────────────────────────

export const slides: Slide[] = [
  // ── 1 · Title ────────────────────────────────────────────────────────────
  {
    id: "title",
    label: "Intro",
    render: () => (
      <div className="slide-inner">
        <div className="glow a" />
        <div className="glow b" />
        <PixelAstro className="slide-astro" size={260} />
        <span className="eyebrow">
          <span className="pulse" /> Salesforce World Tour · Stockholm Breakout
        </span>
        <h1 className="title-xl">
          Vibe-code your <span className="grad">Agentforce</span> agents
          <br />
          on the <span className="grad">Headless 360</span> platform.
        </h1>
        <p className="kicker">
          Every Salesforce capability is now an API, an MCP tool, or a CLI
          command. Bring your favourite coding agent — Claude Code, Codex,
          Cursor, Agentforce Vibes — and ship Agentforce agents from a prompt.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="chip"><b>Headless 360</b></span>
          <span className="chip"><b>sf-pi</b> coding agent</span>
          <span className="chip"><b>MCP</b> · Salesforce DX · Agentforce</span>
          <span className="chip">Plan · Build · Test</span>
        </div>
      </div>
    ),
  },

  // ── 2 · The shift ───────────────────────────────────────────────────────
  {
    id: "shift",
    label: "The shift",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> What changed at TDX</span>
        <h2 className="title-lg">
          The browser is now <span className="grad">optional</span>.
        </h2>
        <p className="kicker">
          Salesforce rebuilt the platform for agents. The CRM, Agentforce,
          Data&nbsp;360, and Slack are exposed as a single programmable surface
          — reachable by any AI agent, coding tool, or external system without
          ever opening a Lightning page.
        </p>

        <div className="grid-3">
          <div className="card">
            <div className="icon">⚡</div>
            <div className="card-eye">API-first</div>
            <h3>Every capability, an API</h3>
            <p>Read, write, configure, deploy. The platform answers JSON, not just HTML.</p>
          </div>
          <div className="card violet">
            <div className="icon">🧩</div>
            <div className="card-eye">MCP-native</div>
            <h3>Hosted MCP servers</h3>
            <p>Salesforce hosts Model Context Protocol servers. Claude Code, Cursor, Codex connect with no custom integration work.</p>
          </div>
          <div className="card teal">
            <div className="icon">⌨️</div>
            <div className="card-eye">CLI-driven</div>
            <h3>Salesforce DX, supercharged</h3>
            <p><span className="mono">sf</span> is the universal lever. Auth, metadata, deploy, anonymous Apex, Agentforce — all scriptable.</p>
          </div>
        </div>
      </div>
    ),
  },

  // ── 3 · Build with any agent ──────────────────────────────
  {
    id: "agents",
    label: "Build with any agent",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> Bring your own coding agent</span>
        <h2 className="title-lg">Pick the tool. The platform is the same.</h2>

        <div className="showcase">
          <figure className="showcase-card">
            <div className="showcase-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/claude_code_terminal.png" alt="Claude Code terminal" />
            </div>
            <figcaption>
              <span className="showcase-eye">Anthropic</span>
              <span className="showcase-name">Claude Code</span>
            </figcaption>
          </figure>

          <figure className="showcase-card">
            <div className="showcase-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/vibes2.png" alt="Agentforce Vibes 2.0" />
            </div>
            <figcaption>
              <span className="showcase-eye">Salesforce native</span>
              <span className="showcase-name">Agentforce Vibes 2.0</span>
            </figcaption>
          </figure>

          <figure className="showcase-card">
            <div className="showcase-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/agent_builder.png" alt="Agentforce Agent Builder" />
            </div>
            <figcaption>
              <span className="showcase-eye">No-code</span>
              <span className="showcase-name">Agent Builder</span>
            </figcaption>
          </figure>
        </div>

        <p className="kicker showcase-foot">
          Same auth, same metadata, same governance — swap the agent without
          swapping the platform.
        </p>
      </div>
    ),
  },

  // ── 4 · Meet sf-pi ───────────────────────────────────────────
  {
    id: "sf-pi",
    label: "Meet sf-pi",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> github.com/salesforce/sf-pi</span>
        <h2 className="title-lg">
          For this demo — <span className="grad">sf-pi</span>.
        </h2>

        <div className="hero-split">
          <div className="hero-art">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/pi-agent.jpg" alt="sf-pi agent" />
          </div>
          <div className="hero-points">
            <ul className="hero-bullets">
              <li><b>Agentforce-aware.</b> <span className="mono">.agent</span> bundles, end-to-end — author, validate, publish, activate.</li>
              <li><b>Headless 360 native.</b> MCP + the full <span className="mono">sf</span> CLI, with a guardrail in front of every destructive call.</li>
              <li><b>Open source.</b> Wraps Claude / GPT-5 / Gemini. Stay in your terminal.</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  // ── 5 · The dev loop ───────────────────────────────────────
  {
    id: "loop",
    label: "Dev loop",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> Agent Development Lifecycle</span>
        <h2 className="title-lg">One loop, three phases.</h2>

        <div className="loop-3">
          <div className="loop-box teal">
            <div className="loop-box-num">01</div>
            <div className="loop-box-name">Plan</div>
            <div className="loop-box-skill mono">sf data query</div>
          </div>
          <div className="loop-arrow" aria-hidden>→</div>
          <div className="loop-box violet">
            <div className="loop-box-num">02</div>
            <div className="loop-box-name">Build</div>
            <div className="loop-box-skill mono">sf-agentscript</div>
          </div>
          <div className="loop-arrow" aria-hidden>→</div>
          <div className="loop-box pink">
            <div className="loop-box-num">03</div>
            <div className="loop-box-name">Test</div>
            <div className="loop-box-skill mono">Agent API</div>
          </div>
        </div>

        <div className="loop-footer">
          <a
            href="https://github.com/SalesforceAIResearch/agentforce-adlc"
            target="_blank"
            rel="noreferrer"
            className="loop-footer-link"
          >
            <span className="mono muted" style={{ letterSpacing: "0.16em", fontSize: 11 }}>
              ADLC
            </span>
            <span style={{ color: "var(--fg-2)" }}>Agentforce Agent Development Lifecycle</span>
            <span className="muted">↗</span>
          </a>
        </div>
      </div>
    ),
  },

  // ── 6 · Plan · Analyse with pi ──────────────────────────────────────────
  {
    id: "plan-analyse",
    label: "Plan · Analyse",
    render: ({ runInPi }) => (
      <div className="slide-inner">
        <span className="eyebrow" style={{ color: "var(--teal)" }}>
          <span className="pulse" /> Phase 01 · Plan
        </span>
        <h2 className="title-lg">
          Ask <span className="grad">pi</span> to plan the agent.
        </h2>

        <PromptBlock
          prompt={PLAN_PROMPT}
          display={PLAN_PROMPT_DISPLAY}
          onRun={runInPi}
          label="Run plan in pi"
          extra={
            <a
              className="btn"
              href={ORG_CASES_URL}
              target="_blank"
              rel="noreferrer"
              title="Open the live org's Cases list in a new tab"
            >
              ↗ Open Cases
            </a>
          }
        />
      </div>
    ),
  },

  // ── 7 · Build · Execute ─────────────────────────────────────────────────
  {
    id: "build-run",
    label: "Build · Execute",
    render: ({ runInPi }) => (
      <div className="slide-inner">
        <span className="eyebrow" style={{ color: "var(--violet)" }}>
          <span className="pulse" /> Phase 02 · Build
        </span>
        <h2 className="title-lg">
          Now ask <span className="grad">pi</span> to build it.
        </h2>

        <PromptBlock
          prompt={BUILD_PROMPT}
          display={BUILD_PROMPT_DISPLAY}
          onRun={runInPi}
          label="Run build in pi"
        />
      </div>
    ),
  },

  // ── 8 · Test · Talk to it ────────────────────────────────────
  {
    id: "test-run",
    label: "Test · Talk to it",
    render: ({ goToAgents }) => (
      <div className="slide-inner">
        <span className="eyebrow" style={{ color: "var(--pink)" }}>
          <span className="pulse" /> Phase 03 · Test
        </span>
        <h2 className="title-lg">
          Now <span className="grad">talk to it</span>.
        </h2>

        <div className="row" style={{ margin: "6px 0 22px", gap: 10 }}>
          <button className="btn primary" onClick={goToAgents}>
            ✨ Open the agent chat
          </button>
          <a
            className="btn"
            href={AGENTFORCE_STUDIO_URL}
            target="_blank"
            rel="noreferrer"
            title="Open Agentforce Studio (Agents) in a new tab"
          >
            ↗ Agentforce Studio
          </a>
        </div>

        <div className="utterances">
          {TEST_UTTERANCES.map((u, i) => (
            <div className="utterance" key={i}>
              <div className="utterance-head">
                <span className="chip pink"><b>#{i + 1} · {u.label}</b></span>
                <span className="mono muted" style={{ fontSize: 11 }}>
                  case {u.caseNumber} · {u.email}
                </span>
              </div>
              <p className="utterance-text">
                {renderHighlighted(
                  u.text
                    .replace(u.caseNumber, `**${u.caseNumber}**`)
                    .replace(u.email, `**${u.email}**`),
                )}
              </p>
              <div className="utterance-actions">
                <button
                  className="btn"
                  onClick={() => navigator.clipboard?.writeText(u.text).catch(() => {})}
                  title="Copy this utterance to the clipboard"
                >
                  ⧉ Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];
