# AGENTS.md

> **Heads-up for the next agent.** This is a Salesforce DX project that
> doubles as a *live presentation rig*. Most of your work happens inside
> `presentation/` (a Next.js app). The SFDX side (`force-app/`) is a
> placeholder — it will be populated **by the demo itself** when `pi` runs the
> build prompt. Do not delete `force-app/` or treat the empty state as a bug.

---

## 1. What this project is

A Next.js web app at `presentation/` that hosts an interactive **Headless 360**
breakout for the **Stockholm Salesforce World Tour**. It tells a Plan → Build →
Test story about vibe-coding Agentforce agents with `sf-pi`, and runs an
*actual live demo* against a real Salesforce org from inside the same browser
window — no tab-switching, no slides-in-Keynote.

The presenter never has to leave the app. Four tabs cover the full journey:

| # | Tab | What it is |
|---|-----|------------|
| 1 | **📊 Slides** | 9-slide deck. Two of the slides have **⚡ Run in pi** buttons that drive the terminal tab. The Plan·Analyse slide also has an inline `↗ Open Cases` link that opens the Salesforce Cases list in a new tab (no in-app embedding — Salesforce CSP blocks framing). Speaker-first design: minimal text on slides, the speaker tells the story. |
| 2 | **📁 Planning** | File explorer + HTML/Markdown viewer, scoped to `planning/` by default so the audience sees only the demo's output. Segmented toggle in the header (`📁 Planning` / `📦 Whole project`) flips to the full SFDX root for poking at `force-app/`, etc. **Manual refresh** — click ↺ Refresh after `pi` writes new files. |
| 3 | **⚡ Live demo** | `ghostty-web` terminal in an iframe, talking WebSocket→PTY to a `node-pty` shell rooted at the SFDX project. Toolbar has a **▶ Start pi agent** button to launch an interactive `pi` session manually; slide ⚡ Run buttons type `pi '<prompt>'` directly at the shell with the prompt pre-filled as argv. |

The repo has only **one** SFDX project at the root. `presentation/` is a peer
folder, not nested inside `force-app/`. Anything `pi` writes during the demo
(Apex classes, `.agent` bundles, planning artefacts) lands at the SFDX project
root, which is exactly where the demo expects to render it.

---

## 2. The demo storyline (slide-by-slide)

Each slide id corresponds to a slide in `presentation/components/slides.tsx`.

| # | id | Phase | Beat |
|---|----|-------|------|
| 1 | `title` | — | Hook + framing |
| 2 | `shift` | — | Headless 360 = API-first / MCP-native / CLI-driven |
| 3 | `agents` | — | Claude Code, Codex, Agentforce Vibes — interchangeable |
| 4 | `sf-pi` | — | Why we use `sf-pi` for the demo |
| 5 | `loop` | — | Plan · Build · Test loop |
| 6 | `plan-analyse` | **Plan** | Highlighted prompt + ⚡ Run → drives `pi` to write `planning/case-deflection-plan.html`. Inline `↗ Open Cases` button opens the org's Cases list in a new tab so the speaker can show real backlog. |
| 7 | `plan-review` | **Plan** | "Open the planning workspace" — button switches to Planning tab; new HTML auto-opens |
| 8 | `build-intro` | **Build** | Narrative: 2 stub Apex actions, 1 agent, 1 subagent, validate + publish |
| 9 | `build-run` | **Build** | Prompt + ⚡ Run → drives `pi` to actually build it (no preview, no eval) |

There is **no Test phase slide yet** — see §8.

---

## 3. Architecture

```
                             ┌────────────────────────────────────────────────┐
                             │ presentation/  (Next.js 15, App Router, custom │
                             │                  Node server)                  │
                             │                                                │
   browser  ──── HTTP ────▶  │  Next request handler                          │
                             │  ├ /                  page.tsx + tabs          │
                             │  ├ /api/files         project tree (sandboxed) │
                             │  ├ /api/files/content file body (≤2 MB, text)  │
                             │  └ /terminal.html     ghostty-web iframe page  │
                             │                                                │
   browser  ── WebSocket ─▶  │  ws upgrade on /ws  ──▶  node-pty.spawn(SHELL) │
                             │                          cwd = ../  (SFDX root)│
                             └────────────────────────────────────────────────┘
                                                 │
                                                 ▼
                                       <project_root>/  (this repo)
                                       ├ force-app/    (SFDX, populated by build phase)
                                       ├ planning/     (created by server.mjs on boot)
                                       ├ presentation/ (the Next.js app)
                                       └ …
```

### Cross-tab control flow (the trickiest bit)

Slide → terminal command injection works via **postMessage to a sibling
iframe** rather than reaching into ghostty-web from React:

```
slide button  ─[runInPi(prompt)]→  app/page.tsx
                                       │
                                       │ 1. setTab("terminal")
                                       │ 2. cmd = `pi ${shellQuote(prompt)}`
                                       │ 3. terminalRef.current.runCommand(cmd)
                                       ▼
                              components/TerminalFrame.tsx
                                       │
                                       │ if iframe ready:    postMessage({type:'run', cmd})
                                       │ else:               queue, mount iframe, dispatch on 'ready'
                                       ▼
                                  public/terminal.html
                                       │
                                       │ window.addEventListener('message')
                                       │   → ws.send(cmd + '\r')
                                       ▼
                                    PTY (zsh)
                                       │
                                       ▼
                                pi '<the prompt>'    (argv → interactive pi session)
```

Origin is checked on **both sides** (`event.origin === location.origin`).
The terminal page emits `{type: 'ready'}` to its parent the moment its
WebSocket opens, so the parent can flush a queued command if the user clicked
Run before the iframe finished mounting.

POSIX single-quote escape (`'` → `'\''`) lives in `app/page.tsx::shellQuote`
— the prompt's literal apostrophes survive the shell verbatim. The shell
launches `pi` with the prompt as argv[1], pi opens its interactive TUI, and
the message arrives pre-filled.

### Why an iframe for the terminal?

`ghostty-web` is a WASM-backed ESM module. Loading it through Next.js's
webpack pipeline means fighting WASM asset rules. Hosting it in a static HTML
page in `public/` and embedding via `<iframe>` sidesteps the bundler entirely
and was the simplest way to get to "boring works." If WASM loading ever fails
(strict CSP etc.), `terminal.html` automatically falls back to `xterm.js` from
`esm.sh`.

### Why a custom Node server?

Two reasons:

1. We need to handle a `WebSocket` upgrade on the same origin as the Next app
   (so we can use a relative `ws://…/ws` URL from the iframe and skip CORS).
2. We need the WS handler to spawn `node-pty` with `cwd` set to the SFDX
   project root, *not* the Next app root.

`server.mjs` starts the Next request handler and the `ws` server in the same
HTTP listener.


---

## 4. File map

```
agentforce/                                   ← SFDX project root, also Next custom server cwd's parent
├── AGENTS.md                                 ← this file
├── force-app/                                ← SFDX (build phase writes Apex classes here)
├── planning/                                 ← created on boot; agent writes HTML reports here
│   └── README.md                             ← placeholder so the explorer has something to show
├── sfdx-project.json
└── presentation/                             ← THE NEXT.JS APP
    ├── server.mjs                            ← Next handler + WS upgrade /ws → node-pty
    ├── package.json                          ← deps: next, react, ws, @lydell/node-pty, marked
    ├── tsconfig.json · next.config.mjs · next-env.d.ts · .gitignore · README.md
    ├── public/
    │   └── terminal.html                     ← ghostty-web (xterm.js fallback) + postMessage protocol (run / interrupt)
    ├── app/
    │   ├── layout.tsx · globals.css          ← labs.salesforce.com dark aesthetic
    │   ├── page.tsx                          ← 4-tab shell, keyboard routing, runInPi()
    │   └── api/
    │       ├── files/route.ts                ← GET /api/files?path=…   (sandboxed listing)
    │       └── files/content/route.ts        ← GET /api/files/content  (sandboxed read)
    └── components/
        ├── SlideDeck.tsx                     ← deck container, dot-nav, keyboard nav
        ├── slides.tsx                        ← 9 slides + PLAN_PROMPT (+ PLAN_PROMPT_DISPLAY w/ `**...**` highlights) / BUILD_PROMPT + <PromptBlock>
        ├── Planning.tsx                      ← tree explorer + HTML/MD viewer + manual refresh + scope toggle (planning-only ↔ whole project)
        └── TerminalFrame.tsx                 ← forwardRef + useImperativeHandle (runCommand/interrupt/reset)
```

**Hard-coded paths (single-source-of-truth):**

- Salesforce Cases URL → `presentation/components/slides.tsx::ORG_CASES_URL` (used by the Plan·Look slide button)
- Planning folder name → `presentation/components/Planning.tsx::PLANNING_PATH = "planning"`
- Project root resolution → `path.resolve(process.cwd(), '..')` in both API routes and `server.mjs`. The Next custom server is launched from `presentation/`, so `..` is always the SFDX project root.

If you move folders around, update those three places together.

---

## 5. Run / configure

```bash
cd presentation
npm install          # one time
npm run dev          # → http://localhost:3000
```

The dev script is `node server.mjs` (NOT `next dev`). Don't run `next dev`
directly — it boots only the page handler, no `/ws`, no `/api/files`.

### Environment variables

| Var       | Default              | Purpose |
|-----------|----------------------|---------|
| `PORT`    | `3000`               | HTTP + WS port |
| `PI_CMD`  | `$SHELL` (`/bin/zsh`) | Command spawned by node-pty for each WS connection |
| `PI_ARGS` | `-l`                 | Whitespace-separated args for `PI_CMD` |

Why default to `$SHELL` instead of `pi`? Because the slides drive the demo by
typing `pi '<prompt>'` into the terminal, which only works at a shell prompt.
If you want an interactive `pi` session right away, run:

```bash
PI_CMD=pi PI_ARGS="" npm run dev
```

…but then the slide ⚡ Run buttons will misbehave (they'd feed `pi '...'` to
an already-running pi instance, which interprets it as a new prompt rather
than a shell command).

### Keyboard

| Key | Action |
|-----|--------|
| `1` `2` `3` | jump to tab |
| `t` | cycle tabs |
| `←` `→` `Space` `PageUp/Down` | prev / next slide |
| `Home` `End` | first / last slide |

Inputs / textareas / contenteditable are excluded from the global handlers.

---

## 6. Key invariants & gotchas

### POSIX shell quoting in `runInPi`

`app/page.tsx::runInPi` POSIX-escapes the prompt with the canonical
single-quote trick (`'` → `'\''`) and types `pi '<escaped>'` at the shell.
pi accepts the prompt as argv[1] and opens its interactive TUI pre-filled
with that message. Multi-line prompts work fine — zsh handles literal
newlines inside single-quoted strings without issue.

The `<PromptBlock>` Copy button copies the **raw prompt** (not the wrapped
shell command) so a presenter can paste it into a separate `pi` session if
they prefer.

### Path-traversal guard

`/api/files` and `/api/files/content` resolve the user-supplied `path` against
`PROJECT_ROOT` and reject anything that doesn't start with
`PROJECT_ROOT + path.sep`. Verified by tests; do not regress.

### Salesforce opens in a new tab — we don't fight CSP

Lightning ships with `Content-Security-Policy: frame-ancestors 'self'` plus
`X-Frame-Options: SAMEORIGIN`. Iframing it is a non-starter on most demo
orgs. Earlier iterations tried (a) iframing it, (b) replacing the iframe with
a server-side `sf data query` rendered as cards in-app — both added
complexity for marginal benefit.

The current solution is the simplest one: the Plan·Look slide has a single
`↗ Open Cases in new tab` button that opens
`https://orgfarm-22ccc7c65d.lightning.force.com/lightning/o/Case/list?filterName=AllOpenCases`
in a new browser tab. Audience watches the Lightning UI, then comes back to
the demo tab to keep going. The URL is in `slides.tsx::ORG_CASES_URL`.

### `force-app/` may be empty

Until the build phase runs in the demo. That's the *point* of the build phase.
Don't pre-create stub Apex unless the user asks.

### The planning folder must exist for the explorer to work cleanly

`server.mjs` `mkdir`s `<root>/planning/` and seeds a `README.md` placeholder
on every boot. The Planning tab is **manual refresh only** — click ↺ Refresh
after `pi` writes a new file. (We removed the 2 s poll because the live
heartbeat was distracting and a button is enough.)


### The terminal iframe is lazy-mounted

It only mounts when you first activate the Live demo tab. This avoids burning
a WS connection at page load. `runInPi` triggers the mount automatically and
queues the command until the iframe says it's `ready`. **Don't move the
mount-on-activate behaviour — it's load-bearing for the demo flow.**


### `marked` is sync, not async

`Planning.tsx` uses `marked.parse(content, { async: false })`. v14+ defaults
to async; we explicitly opt out. Output is fed through
`dangerouslySetInnerHTML`. For our use case (reading our own files) this is
fine — but if the explorer ever displays **untrusted** content, add DOMPurify
before shipping.


### `ghostty-web` from CDN, not bundled

`terminal.html` imports `https://esm.sh/ghostty-web@latest`. This means the
demo needs network access at first load. If you ever run the demo offline,
either pre-cache esm.sh or vendor the package into `public/`.

---

## 7. The two prompts (`PLAN_PROMPT` / `BUILD_PROMPT`)

Both live in `presentation/components/slides.tsx` as exported constants.
Editing them is the lever for changing what the demo agent does.

### Plan prompt — invariants

- **Audience-first wording.** This prompt is shown to a live audience on
  stage. Keep it short, plain English, and structured as a numbered list —
  no jargon they won't recognize. Speaker tells the story.
- **Read-only org calls only.** Uses `sf data query`. No DML, no deploy.
- **Output path is hard-coded:** `planning/case-deflection-plan.html`. The
  Planning tab's auto-pop logic prefers `.html` then `.md`, so renaming the
  output file is fine, but keep it in `planning/`.
- **Two strings, kept in lock-step:** `PLAN_PROMPT` (raw text, sent to pi)
  and `PLAN_PROMPT_DISPLAY` (same content, with `**word**` markers around
  the bits we want highlighted on the slide). Edit both together — the
  display string is rendered through `renderHighlighted()` which only
  understands `**...**`. Anything else is treated as literal text.
- **Step 3 is the build-phase blueprint.** It enumerates exactly what the
  build phase needs to scaffold the agent cleanly: topic name + scope, 1–2
  actions with their name/inputs/return shape, the customer-facing reply,
  and a success metric. If you trim step 3, the BUILD_PROMPT will start
  guessing at the agent shape and the build output won't match the plan.
- **Style requirements** (dark, salesforce-blue, inline CSS) are kept brief
  in the prompt itself. The Planning tab renders the result in a sandboxed
  iframe — test-render the agent's output before each demo.
- **Keep the report short.** The prompt explicitly asks for a SHORT /
  concise HTML so the live audience isn't watching pi generate paragraph
  after paragraph for a minute. If you grow the report, expect generation
  time to grow with it.
- **HTML/CSS diagram of the agent (no SVG).** The prompt asks pi to draw
  a tiny flexbox tree — topic box on top, 1–2 action boxes below,
  connected with a thin line. We deliberately avoid SVG: flexbox + border-
  radius is fewer tokens for pi to emit, less coordinate math to get wrong,
  and renders identically in the sandboxed Planning iframe. Don't drop
  this — the diagram is the first thing the audience sees when the
  Planning tab pops the new HTML.

### Build prompt — invariants

- **Exactly 2 stub Apex `@InvocableMethod` actions.** No DML, no SOQL writes.
- **Exactly 1 agent, exactly 1 subagent**, the subagent calls **both** actions.
- **Validate + publish ONLY.** Explicitly forbids `agentscript_preview` and
  `agentscript_eval` — those belong to the next phase.
- **Confirmation card is HTML inside the agent's reply instructions.** Inline
  CSS, dark theme, salesforce-blue. The agent renders this in the chat UI when
  the actions complete.

If you change the constraints (e.g. allow more actions), update the
corresponding **Build · Intro** slide cards too — they currently read "Two stub
Apex actions / One agent, one subagent / Validate & publish". Keep the slides
and the prompt in lockstep so the audience isn't lied to.

---

## 8. TODO — Phase 3 (Test) is not built yet

The deck currently ends after the Build phase. The user has previously
described a three-phase arc (`Plan → Build → Test`) and the **dev loop** slide
shows three phase cards, but only Plan and Build have been built out.

To add the Test phase, expect these touch points:

1. **Two new slides** in `slides.tsx`:
   - `test-intro` — narrative: now we run the agent against the same cases
     and verify it deflects them. Open the terminal again, or open the org and
     watch the agent reply on a test case.
   - `test-run` — `<PromptBlock>` with a third prompt (`TEST_PROMPT`) that
     calls `agentscript_preview` (single-turn) or `agentscript_eval` (against
     a generated spec) and writes a results file (Markdown or HTML) into a
     new folder, e.g. `planning/test-results.md`. The Planning tab will
     auto-pop it because polling already covers all of `planning/`.
2. **A "Phase 03" tile** on the dev-loop slide is already present — switch
   `opacity: 0.4` to neutral once Test exists.
3. Consider adding an `agentscript_preview` log viewer to the Planning tab —
   not strictly necessary; the terminal already shows the trace.

Suggested test prompt skeleton:

```
You are sf-pi. The agent we built is published. Test it.

1. agentscript_eval action='generate_spec' agent_file=<.agent path>  output_path=planning/test-spec.json
   (review the synthesized spec; cap functional tests at 5 to keep the demo fast)
2. agentscript_eval action='run' spec_path=planning/test-spec.json agent_api_name=<api name>
3. Render a polished HTML summary at planning/test-results.html: pass/fail per test,
   the recurring-theme cases this agent would deflect, and a one-paragraph "ship
   it / don't ship it" verdict. Same dark salesforce-blue aesthetic as the plan report.
```

When you build this, add a `goToPlanning` call from `test-run` (same UX as
`plan-review`) so the audience sees the results file pop in.

---

## 9. Other open TODOs / nice-to-haves

- **Salesforce Cases URL is hard-coded** in `slides.tsx::ORG_CASES_URL`.
  Optionally accept `?org=…` on the page URL or read `NEXT_PUBLIC_ORG_URL` so
  the same bundle works for other presenters.
- **File explorer:** doesn't show write-time toasts. A small "✦ new" badge
  next to a file that appeared in the last 30 s would punch up the moment
  when the agent finishes writing.
- **Pop-out terminal:** `↗ Pop out` opens a new tab, but the popped-out window
  starts a **second** PTY session. Might be desirable (presenter can have a
  monitor showing the terminal full-screen while still working in the deck).
  If you ever want them to share a session, you'll need a session id on the
  WS upgrade and a session registry in `server.mjs`.
- **Linting:** Next told us "ESLint must be installed". Not installed
  intentionally to keep deps minimal — add it back if the team wants
  pre-commit checks.
- **Playwright/CI:** none. The full pipeline is verified by hand-run smoke
  tests in this codebase's history. If you add CI, the most valuable check is
  the WS-injection round-trip (already scripted as a Node one-liner that
  injects `echo HEADLESS-360-OK` and reads it back).
- **Testing on Windows:** untested. `@lydell/node-pty` claims Windows support
  via ConPTY but the `default-shell` resolution in `server.mjs` will pick
  `powershell.exe`; verify before any non-mac demo.

---

## 10. Verified working (smoke checklist)

Before any presentation, run:

```bash
cd presentation && npm run dev   # in one shell
```

…and from a second shell:

```bash
# 1. Page renders
curl -s -o /dev/null -w "/ %{http_code}\n" http://localhost:3000/

# 2. Static terminal page renders
curl -s -o /dev/null -w "/terminal.html %{http_code}\n" http://localhost:3000/terminal.html

# 3. File API
curl -s "http://localhost:3000/api/files?path=planning" | python3 -m json.tool | head

# 4. Sandbox holds
curl -s -o /dev/null -w "traversal %{http_code}\n" "http://localhost:3000/api/files?path=../../../etc"
# expect: 403

# 5. PTY round-trip with command injection (the same flow as the slide ⚡ Run buttons)
node -e '
const W=require("ws"),w=new W("ws://localhost:3000/ws?cols=120&rows=32");let b="";
w.on("open",()=>setTimeout(()=>w.send("echo SMOKE-OK && exit\r"),250));
w.on("message",d=>b+=d.toString());
w.on("close",()=>{const c=b.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g,"");console.log(c.includes("SMOKE-OK")?"OK":"FAIL");process.exit(c.includes("SMOKE-OK")?0:1);});
setTimeout(()=>process.exit(1),6000);'
```

If all five pass, the demo rig is operational.

Then on the running app: open http://localhost:3000, click each tab once
(Slides → Planning → Live demo) so iframes warm up and `pi`'s first
turn isn't fighting a cold start during the actual presentation.

---

## 11. Style / convention notes

- **Dark theme, labs.salesforce.com aesthetic.** Salesforce blue
  (`#00a1e0` / `#38bdf8`) is the primary accent; secondary accents are violet
  (`#a78bfa`), teal (`#00e5a0`), pink (`#f472b6`), amber (`#ffd166`). All
  defined as CSS custom properties in `app/globals.css` — use `var(--accent)`
  etc., never hard-code.
- **Phase colour-coding.** Plan = teal, Build = violet, Test = pink. Carries
  through eyebrow text, phase chips, dev-loop tiles. Keep this consistent if
  you add the Test phase.
- **No CSS frameworks.** Plain CSS in `globals.css`. Don't reach for Tailwind
  or styled-components unless you have a strong reason — the rest of the file
  already covers what we need and adding a build dependency for a single new
  card style is overkill.
- **No client-side router.** The four "tabs" are state, not routes. This is
  intentional — switching tabs must NEVER unmount the terminal iframe (it'd
  drop the PTY and any running `pi` session).
- **Marked v14, not v15.** Pinned because v15 changed the sync-API contract.
- **Server is ESM (`type: "module"`).** The `.mjs` extension is explicit so
  it's obvious from the filename. Use `import`, not `require`.

---

## 12. If something feels off

| Symptom | First thing to check |
|---------|---------------------|
| Run button does nothing | Is `PI_CMD` set to `pi` instead of `$SHELL`? You're feeding `pi '...'` into a running `pi` instance. |
| Terminal blank / "connecting…" forever | Network tab: did `/ws` upgrade succeed? Is `node server.mjs` actually running (vs `next dev`)? |
| Salesforce tab won't load | The Cases URL hardcoded in `slides.tsx::ORG_CASES_URL` is for one specific demo org. Update it for your own org. |
| New file in `/planning/` doesn't appear | Click ↺ Refresh in the Planning tab. There's no live polling — by design. |
| HTML report looks broken | The agent wrote external `<link>` / `<script>`. Re-emphasise "self-contained, inline CSS, no external network" in `PLAN_PROMPT`. |
| `force-app/` build prompt fails | `sf` not authed, or `pi` missing on `PATH`. `which pi` and `sf org list` to confirm. |
| Two terminal sessions appear | You popped out via `↗ Pop out` — see §9; that opens a second PTY by design. |

---

*Last update: 3-tab rig (Slides / Planning / Live demo). 9 slides — `plan-look` removed, `↗ Open Cases` button moved inline onto the Plan·Analyse slide. PLAN_PROMPT shortened for live audience and rendered with `**word**` highlights via PLAN_PROMPT_DISPLAY; step 3 spells out the agent design (topic / actions / inputs / returns / reply / success metric) so BUILD_PROMPT has a clean blueprint. Report kept SHORT for fast generation and includes a simple HTML/CSS flexbox diagram of the agent (no SVG — fewer tokens, no coordinate math). Planning tab now defaults to a scoped view of `planning/` only, with a segmented toggle to flip into the whole SFDX project. Salesforce opens in a new tab. `pi '<prompt>'` argv injection — no bracketed paste, no auto-launch state. Plan + Build phases shipped. Test phase pending — see §8.*
