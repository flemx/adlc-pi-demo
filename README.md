# Vibe-coding Agentforce on Headless 360

> **Live demo for the Salesforce World Tour Stockholm breakout.**
> Plan, build, test an Agentforce service agent end-to-end from a single prompt — driven by [`sf-pi`](https://github.com/salesforce/sf-pi), live against a real org, in under 60 seconds.

<!--
  📸  Hero screenshot. Drop a PNG into presentation/public/images/ and update
  the path below. Suggested filename: hero.png  (or recording.gif).
-->

![Demo screenshot](presentation/public/images/hero.png)

---

## What this is

A Next.js single-page demo app that hosts a 4-tab presentation rig:

| # | Tab | What it does |
|---|-----|--------------|
| 1 | **📊 Slides** | 8-slide deck. Two slides have **⚡ Run in pi** buttons that drive the terminal tab. The Test slide ships three example utterances with Case Numbers + emails to chat with the published agent. |
| 2 | **📁 Planning** | File explorer scoped to `planning/` by default — that's where `pi` writes its analysis HTML. Toggles to the full SFDX project on demand. |
| 3 | **✦ Agents** | Lists every Active service agent in the org via SOQL, click one to open a real streaming chat session against `https://api.salesforce.com/einstein/ai-agent/v1` (server-side OAuth proxy + SSE pass-through). Same look-and-feel as the rest of the app. |
| 4 | **⚡ Live demo** | `ghostty-web` terminal (xterm.js fallback) wired through a `node-pty` shell rooted at the SFDX project. Slide buttons type `pi '<prompt>'` directly — pi opens with the prompt pre-filled. |

The demo walks the **Agent Development Lifecycle (ADLC)**:

```
PLAN  ──→  BUILD  ──→  TEST
sf data    sf-agentscript    Agent API
query
```

1. **Plan.** `pi` reads the org's 5 most recent Cases, finds the common theme, designs ONE service agent (topic, 1–2 actions with input/return shape, customer-facing reply, success metric), and writes the result as a styled HTML report to `planning/case-deflection-plan.html`.
2. **Build.** `pi` writes two stub Apex `@InvocableMethod` actions, deploys them, scaffolds an Agent Script bundle with **EXACTLY ONE subagent marked as `start_agent`** (no router), validates, and publishes + activates.
3. **Test.** The presenter clicks ✦ Agents, picks the just-published agent, and runs the example utterances from the Test slide. The chat panel streams the agent's responses live.

Reference: [Salesforce AI Research · Agentforce ADLC](https://github.com/SalesforceAIResearch/agentforce-adlc).

---

## Repo layout

```
agentforce/
├── AGENTS.md                          ← sf-pi project guardrails (read automatically by pi
│                                         when it boots in this directory)
├── force-app/                         ← Apex classes pi writes during the Build phase
├── planning/                          ← HTML reports pi writes during the Plan phase
└── presentation/                      ← the Next.js demo app
    ├── AGENTS.md                      ← presentation-app authoring docs
    ├── server.mjs                     ← Next + WebSocket /ws → spawns $SHELL
    ├── lib/agentforceAuth.ts          ← OAuth client_credentials helper
    ├── app/
    │   ├── page.tsx                   ← 4-tab shell, keyboard 1/2/3/4
    │   └── api/
    │       ├── files/                 ← sandboxed file listing + content
    │       └── agents/                ← list / session / message (SSE proxy)
    ├── components/
    │   ├── slides.tsx                 ← 8 slides + PLAN_PROMPT / BUILD_PROMPT
    │   ├── SlideDeck.tsx              ← deck shell
    │   ├── Planning.tsx               ← file tree + viewer
    │   ├── AgentsPanel.tsx            ← agent list + chat overlay
    │   ├── AgentChat.tsx              ← streaming chat UI
    │   ├── TerminalFrame.tsx          ← ghostty-web iframe + postMessage
    │   └── PixelAstro.tsx             ← floating Astro mascot (slide 1)
    └── public/
        ├── terminal.html              ← ghostty-web + xterm.js fallback
        └── images/                    ← Astro avatar, agent-tool screenshots
```

The two `AGENTS.md` files have different audiences:

- **`agentforce/AGENTS.md`** — read by `pi` when it boots in this project. Contains build-phase invariants (single-subagent topology, `lightning__numberType` over `lightning__doubleType`, the publish recipe, common mistakes from prior demo runs).
- **`presentation/AGENTS.md`** — read by humans / agents authoring the demo app itself. 4-tab architecture, slide pipeline, prompt design, troubleshooting.

---

## Quick start

```bash
# 1. Auth the org you want to demo against
sf org login web --alias my-agentforce-org --set-default

# 2. Install presentation deps
cd presentation
npm install

# 3. Start the demo (custom Node server: Next + WebSocket + node-pty)
npm run dev
```

Open <http://localhost:3000>. Keyboard:

- `1` `2` `3` `4` — jump to a tab.
- `t` — cycle through tabs.
- `←` `→` `Space` — slide nav.

Stop with `Ctrl-C` in the terminal that owns the dev server.

### Required env vars

For the **✦ Agents** tab (live chat against AgentForce API), drop a `.env.local` into `presentation/`:

```bash
# presentation/.env.local
NEXT_PUBLIC_SALESFORCE_INSTANCE_URL=https://orgfarm-22ccc7c65d.my.salesforce.com
SALESFORCE_CLIENT_ID=<consumer key from your Connected App>
SALESFORCE_CLIENT_SECRET=<consumer secret>
```

Set up a Connected App in the same org with **OAuth → Enable Client Credentials Flow**, scopes `chatbot_api`, `sfap_api`, `api`. Without these the Agents tab renders a "configure your connected app" empty state with the exact missing-vars list — the rest of the demo (Slides / Planning / Live demo) works fine.

The **Live demo** tab uses your existing `sf` CLI auth — no extra setup.

---

## The two prompts

Both live in [`presentation/components/slides.tsx`](presentation/components/slides.tsx) as exported constants. Each has a paired `*_DISPLAY` version with `**word**` markers around the audience-visible highlights — same content, lock-step verified.

### `PLAN_PROMPT` — short, audience-first, build-phase blueprint

> Read the **5 most recent Cases** from the default org and propose **ONE Agentforce service agent** that would deflect the most of them.
>
> 1. Pull the 5 newest Cases via `sf data query` (Subject, Description, Status, Priority, Account.Name).
> 2. Find the **common themes** across them.
> 3. Design **ONE service agent** in enough detail that we can scaffold it next: **topic name** + which Cases it handles, **1–2 actions** (action name, **inputs**, **what it returns**), the **reply** the agent sends back to the customer, **success metric**.
> 4. Save a **short HTML report** at `planning/case-deflection-plan.html` with a small flexbox diagram of the agent (no SVG). Keep it concise so it generates quickly.
>
> Read-only — no DML, no deploy.

### `BUILD_PROMPT` — slimmed; implementation guardrails live in `AGENTS.md`

> Build the Agentforce agent described in `planning/case-deflection-plan.html`. Keep it tiny — target under 60 seconds end to end.
>
> 1. Read the planning HTML.
> 2. Write **TWO stub Apex `@InvocableMethod` actions**, no DML / no SOQL.
> 3. Deploy both classes in a single `sf project deploy` call.
> 4. Use `agentscript_authoring` to create a bundle with **EXACTLY ONE subagent** that calls **BOTH actions**. **That subagent IS the `start_agent`** — no router agent on top.
> 5. Reply with a self-contained HTML confirmation card.
> 6. Validate, publish + activate. Don't run preview or eval — that's the next phase.

The dialect details (`lightning__numberType`, exact `agentscript_lifecycle` args, the bundle XML structure) are all pushed down into [`AGENTS.md`](AGENTS.md) at the project root — pi auto-reads it.

---

## Architecture highlights

- **WebSocket → PTY pipeline.** The Live demo tab is a real shell, not a fake terminal. `presentation/server.mjs` is a custom Node server that hosts Next.js *and* upgrades `/ws` to a node-pty session, so slide buttons can drive a live `pi` interactively.
- **postMessage cross-tab control.** Slide ⚡ Run buttons → `runInPi(prompt)` in `app/page.tsx` → POSIX-quote the prompt → postMessage to the terminal iframe → `ws.send(cmd + '\r')`. Origin checked on both sides.
- **AgentForce SSE proxy.** `/api/agents/message` pipes Salesforce's `text/event-stream` straight to the browser via `ReadableStream`. The browser parses event frames in `AgentChat.tsx` and drives a streaming UI with `ProgressIndicator`, `TextChunk`, `Inform`, `Inquire`, `EndOfTurn`, `Error` events — including the welcome message returned in the session-start response.
- **Speaker-first slide design.** Minimal text. Each phase collapses to one actionable slide. Audience-visible content is `**highlighted**` via a tiny markdown subset; the highlight markers are stripped before the prompt is sent to `pi`.
- **Dual `AGENTS.md`.** Project-root for `pi`, `presentation/` for the demo app. Both stay in lock-step with the code via explicit invariants sections.

---

## Smoke-test checklist (matches `presentation/AGENTS.md` §10)

```bash
cd presentation && npm run dev   # leave running

# In another shell:
curl -fs http://localhost:3000/                                                # 200
curl -fs http://localhost:3000/terminal.html                                   # 200
curl -fs "http://localhost:3000/api/files?path=planning"                       # 200 + exists:true
curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000/api/files?path=../../../etc"   # 403
curl -s "http://localhost:3000/api/agents" | head -c 300                       # 200 + agents[] (or 503 + missing[])

# WebSocket → PTY round-trip:
node -e '
const W=require("ws"),w=new W("ws://localhost:3000/ws?cols=120&rows=32");let b="";
w.on("open",()=>setTimeout(()=>w.send("echo SMOKE && exit\r"),250));
w.on("message",d=>b+=d.toString());
w.on("close",()=>{const c=b.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g,"");process.exit(c.includes("SMOKE")?0:1);});
setTimeout(()=>process.exit(1),5000);'
echo $?  # 0 means OK
```

---

## Tech stack

- **Next.js 15** (App Router, custom Node server)
- **node-pty** (`@lydell/node-pty` fork — prebuilt binaries) over a WebSocket upgrade
- **ghostty-web** terminal in an iframe, `xterm.js` fallback
- **`marked`** for markdown rendering (HTML reports + chat bubbles)
- **`sf` CLI** for org auth + SOQL / deploy from Plan + Build phases
- **Salesforce AgentForce REST API** + Connected-App OAuth client_credentials flow

No database, no external services beyond Salesforce. Everything runs locally on the presenter's laptop.

---

## License

Internal demo. The `sf-pi` agent harness it drives is open-sourced at <https://github.com/salesforce/sf-pi>.
