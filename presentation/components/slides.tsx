import * as React from "react";

export type SlideContext = {
  goToTerminal: () => void;
  goToPlanning: () => void;
  runInPi: (prompt: string) => void;
};

/** Salesforce org Cases list URL — opened in a new tab from the Plan slide. */
export const ORG_CASES_URL =
  "https://orgfarm-22ccc7c65d.lightning.force.com/lightning/o/Case/list?filterName=AllOpenCases";

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

  // ── 3 · Build with any agent ────────────────────────────────────────────
  {
    id: "agents",
    label: "Build with any agent",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> Bring your own coding agent</span>
        <h2 className="title-lg">Salesforce + the agent of your choice.</h2>
        <p className="kicker">
          Headless 360 doesn’t lock you into one vendor. Any tool that speaks
          MCP or shells out to <span className="mono">sf</span> can drive the
          platform — and they all share the same auth, governance, and metadata.
        </p>

        <div className="grid-3">
          <div className="card">
            <div className="icon">🤖</div>
            <div className="card-eye">Anthropic</div>
            <h3>Claude Code</h3>
            <p>Connect to Salesforce-hosted MCP. Read SOQL, scaffold Apex, deploy from a prompt.</p>
          </div>
          <div className="card violet">
            <div className="icon">⌬</div>
            <div className="card-eye">OpenAI</div>
            <h3>Codex / GPT-5</h3>
            <p>Same MCP surface, same CLI. Same governance trail in Setup Audit.</p>
          </div>
          <div className="card pink">
            <div className="icon">✦</div>
            <div className="card-eye">Salesforce native</div>
            <h3>Agentforce Vibes</h3>
            <p>The first-party vibe-coding experience — built into the platform.</p>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 4 }}>
          <div className="card amber">
            <div className="card-eye">In this demo</div>
            <h3>We use <span className="mono">sf-pi</span></h3>
            <p>
              Salesforce’s open-source coding-agent harness. Wraps Claude /
              GPT-5 / Gemini, ships with Salesforce-aware guardrails, MCP
              connectors, and the full <span className="mono">sf</span> CLI in
              one terminal-native loop.
            </p>
          </div>
          <div className="card">
            <div className="card-eye">Why pi for Agentforce</div>
            <ul className="bullets">
              <li><b>Agent Script</b> authoring tools (compile, preview, eval, publish)</li>
              <li><b>Data 360</b> + <b>Browser</b> + <b>Slack</b> extensions baked in</li>
              <li><b>Operator kernel</b> — retrieve before edit, describe before query</li>
            </ul>
          </div>
        </div>
      </div>
    ),
  },

  // ── 4 · Meet sf-pi ───────────────────────────────────────────────────────
  {
    id: "sf-pi",
    label: "Meet sf-pi",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> github.com/salesforce/sf-pi</span>
        <h2 className="title-lg">
          <span className="grad">sf-pi</span> — your Agentforce dev loop, in one terminal.
        </h2>
        <p className="kicker">
          A coding agent that knows Salesforce. It speaks MCP to the platform,
          drives the <span className="mono">sf</span> CLI safely, and ships with
          16 first-party extensions so you can stay in flow from prompt → live
          agent.
        </p>

        <div className="grid-2">
          <div className="card">
            <div className="icon">🛰️</div>
            <div className="card-eye">Headless 360 native</div>
            <h3>MCP + sf CLI, governed</h3>
            <p>Connects to Salesforce-hosted MCP servers and your local <span className="mono">sf</span> session. Production-org calls gated by a guardrail that classifies dangerous and destructive commands.</p>
          </div>
          <div className="card violet">
            <div className="icon">🧬</div>
            <div className="card-eye">Agentforce-aware</div>
            <h3><span className="mono">.agent</span> bundles, end-to-end</h3>
            <p>
              <span className="mono">agentscript_authoring</span> ·{" "}
              <span className="mono">_preview</span> ·{" "}
              <span className="mono">_eval</span> ·{" "}
              <span className="mono">_lifecycle</span> — author, simulate, regress,
              publish, activate. No tab-switching to Setup.
            </p>
          </div>
          <div className="card teal">
            <div className="icon">📡</div>
            <div className="card-eye">Data 360</div>
            <h3>Live data, queryable</h3>
            <p>Discover DMOs, run Data 360 SQL, inspect Agentforce STDM session traces — straight from the prompt.</p>
          </div>
          <div className="card pink">
            <div className="icon">🪟</div>
            <div className="card-eye">Browser fallback</div>
            <h3>UI when APIs end</h3>
            <p>Drives Lightning Setup with an accessibility-tree browser when there’s no API yet. Last-mile, but still scripted.</p>
          </div>
        </div>
      </div>
    ),
  },

  // ── 5 · The dev loop ─────────────────────────────────────────────────────
  {
    id: "loop",
    label: "Dev loop",
    render: () => (
      <div className="slide-inner">
        <span className="eyebrow"><span className="pulse" /> Plan · Build · Test</span>
        <h2 className="title-lg">One loop, three phases.</h2>
        <p className="kicker">
          For the rest of the demo we’ll walk this loop end-to-end against a
          live org. <span className="mono">pi</span> plans by reading the org,
          builds by scaffolding the agent, and tests by previewing it.
        </p>

        <div className="flow flow-3">
          <div className="step phase teal">
            <div className="n">PHASE 01</div>
            <div className="l">Plan</div>
            <div className="s">Read the cases · find the deflection · write a plan</div>
          </div>
          <div className="step phase violet">
            <div className="n">PHASE 02</div>
            <div className="l">Build</div>
            <div className="s">Scaffold actions · author agent · publish</div>
          </div>
          <div className="step phase pink">
            <div className="n">PHASE 03</div>
            <div className="l">Test</div>
            <div className="s">Preview · eval · ship the version</div>
          </div>
        </div>

        <div className="grid-3" style={{ marginTop: 8 }}>
          <div className="card teal">
            <div className="card-eye">Up next</div>
            <h3>Plan · ask pi to analyse</h3>
            <p>One prompt, one verb. pi reads the case backlog and writes a deflection plan.</p>
          </div>
          <div className="card" style={{ opacity: 0.55 }}>
            <div className="card-eye">Then</div>
            <h3>Build · scaffold the agent</h3>
            <p>pi reads the plan and writes Apex actions + an Agentforce service agent.</p>
          </div>
          <div className="card" style={{ opacity: 0.4 }}>
            <div className="card-eye">Finally</div>
            <h3>Test · validate live</h3>
            <p>Preview the published agent against the org and watch it deflect.</p>
          </div>
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
];
