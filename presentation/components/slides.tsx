import * as React from "react";

export type Slide = {
  id: string;
  label: string;       // shown in dot-nav tooltip
  render: (ctx: { goToTerminal: () => void }) => React.ReactNode;
};

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
          <span className="chip">Live demo at the end →</span>
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
            <p>
              Read, write, configure, deploy. The platform answers JSON, not
              just HTML.
            </p>
          </div>
          <div className="card violet">
            <div className="icon">🧩</div>
            <div className="card-eye">MCP-native</div>
            <h3>Hosted MCP servers</h3>
            <p>
              Salesforce hosts Model Context Protocol servers. Claude Code,
              Cursor, Codex connect with no custom integration work.
            </p>
          </div>
          <div className="card teal">
            <div className="icon">⌨️</div>
            <div className="card-eye">CLI-driven</div>
            <h3>Salesforce DX, supercharged</h3>
            <p>
              <span className="mono">sf</span> is the universal lever. Auth,
              metadata, deploy, anonymous Apex, Agentforce — all scriptable.
            </p>
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
        <h2 className="title-lg">
          Salesforce + the agent of your choice.
        </h2>
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
            <p>
              Connects to Salesforce-hosted MCP servers and your local{" "}
              <span className="mono">sf</span> session. Production-org calls
              gated by a guardrail that classifies dangerous and destructive
              commands.
            </p>
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
            <p>
              Discover DMOs, run Data 360 SQL, inspect Agentforce STDM session
              traces — straight from the prompt.
            </p>
          </div>
          <div className="card pink">
            <div className="icon">🪟</div>
            <div className="card-eye">Browser fallback</div>
            <h3>UI when APIs end</h3>
            <p>
              Drives Lightning Setup with an accessibility-tree browser when
              there’s no API yet. Last-mile, but still scripted.
            </p>
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
        <span className="eyebrow"><span className="pulse" /> Vibe → Agent → Production</span>
        <h2 className="title-lg">
          One loop, six verbs.
        </h2>
        <p className="kicker">
          You describe the agent. <span className="mono">pi</span> authors it,
          compiles it, previews it against the live org, regression-tests it,
          and ships it — without leaving the terminal.
        </p>

        <div className="flow">
          {[
            ["01", "Vibe",      "natural-language intent"],
            ["02", "Author",    ".agent + topics"],
            ["03", "Compile",   "structure + types"],
            ["04", "Preview",   "live org, full trace"],
            ["05", "Eval",      "regression spec"],
            ["06", "Publish",   "activate version"],
          ].map(([n, l, s]) => (
            <div className="step" key={n}>
              <div className="n">{n}</div>
              <div className="l">{l}</div>
              <div className="s">{s}</div>
            </div>
          ))}
        </div>

        <pre className="code-block" aria-label="terminal example">
          <code>
            {"  "}<span className="prompt">›</span> <span className="cmd">pi</span>{"\n"}
            {"  "}<span className="com">{"// pi:"}</span> what would you like to build?{"\n"}
            {"  "}<span className="prompt">›</span>{" "}
            <span className="cmd">
              An order-status agent that takes an OrderId, calls our MCP tool,
              and routes to a human if SLA is breached.
            </span>{"\n\n"}
            {"  "}<span className="com">{"// pi runs:"}</span>{"\n"}
            {"  "}<span className="cmd">agentscript_authoring</span>{"  verb=create  bundle_name=OrderStatus\n"}
            {"  "}<span className="cmd">agentscript_authoring</span>{"  verb=compile mode=check\n"}
            {"  "}<span className="cmd">agentscript_preview</span>{"     action=start  agent_file=…/OrderStatus.agent\n"}
            {"  "}<span className="cmd">agentscript_eval</span>{"        action=run    spec_path=specs/order-status.json\n"}
            {"  "}<span className="cmd">agentscript_lifecycle</span>{"   action=publish activate=true\n"}
            {"  "}<span className="ok">✓ Agent activated · v3 · OrderStatusAgent</span>{"\n"}
          </code>
        </pre>
      </div>
    ),
  },

  // ── 6 · Live demo CTA ────────────────────────────────────────────────────
  {
    id: "demo",
    label: "Live demo",
    render: ({ goToTerminal }) => (
      <div className="slide-inner" style={{ textAlign: "center", justifyItems: "center" }}>
        <span className="eyebrow"><span className="pulse" /> Now: hands on the keys</span>
        <h2 className="title-xl" style={{ textAlign: "center" }}>
          Let’s build it. <span className="grad">Live.</span>
        </h2>
        <p className="kicker" style={{ textAlign: "center", marginInline: "auto" }}>
          The next tab is a real terminal, mounted at the SFDX project root of
          this Salesforce World Tour breakout. We’ll start with{" "}
          <span className="mono">pi</span> — and vibe-code an Agentforce agent
          end-to-end against a live org.
        </p>
        <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
          <button className="btn primary" onClick={goToTerminal}>
            ⚡ Open the live terminal
          </button>
          <span className="chip">
            press <span className="kbd">→</span> or <span className="kbd">2</span> to switch tabs
          </span>
        </div>
      </div>
    ),
  },
];
