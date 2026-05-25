# Headless 360 · Agentforce vibe-coding presentation

Interactive deck + live `pi` terminal for the Stockholm World Tour breakout.

- **Slides** — 6-slide story arc on Headless 360, third-party coding agents
  (Claude Code, Codex, Agentforce Vibes), and `sf-pi` as the demo driver.
- **Live demo tab** — embedded [`ghostty-web`](https://github.com/coder/ghostty-web)
  terminal connected via WebSocket to a `node-pty` session that runs
  [`pi`](https://github.com/salesforce/sf-pi) in the parent SFDX project root.

## Run locally

```bash
cd presentation
npm install
npm run dev
# → http://localhost:3000
```

The custom `server.mjs`:

- serves the Next.js app on `:3000`
- exposes `ws://localhost:3000/ws` → spawns `pi` (cwd = `..`, the SFDX project root)
- proxies stdout/stderr/stdin and resize between the browser and the PTY

## Keyboard

| Key                      | Action                       |
| ------------------------ | ---------------------------- |
| `1` / `2`                | switch to Slides / Live demo |
| `t`                      | toggle tabs                  |
| `←` `→` / `Space`        | prev / next slide            |
| `Home` / `End`           | first / last slide           |

## Configuration

Environment variables read by `server.mjs`:

| Var        | Default | Purpose                                                |
| ---------- | ------- | ------------------------------------------------------ |
| `PORT`     | `3000`  | HTTP + WS port                                         |
| `PI_CMD`   | `pi`    | Command to run in the PTY                              |
| `PI_ARGS`  | `""`    | Whitespace-separated args for `PI_CMD`                 |

Examples:

```bash
PORT=4000 npm run dev                   # different port
PI_CMD=zsh PI_ARGS="-l" npm run dev     # plain shell instead of pi
PI_CMD=pi  PI_ARGS="--model gpt-5"      # pi with custom args
```

## Architecture

```
browser ── /terminal.html ── ghostty-web ── WebSocket ──┐
                                                        │
        Next.js app (page.tsx, SlideDeck, TerminalFrame)│
                                                        ▼
                          server.mjs (Next handler + WS upgrade)
                                                        │
                                                        ▼
                                               node-pty spawns
                                            `pi` in ../  (SFDX root)
```

The terminal runs in an iframe (`<iframe src="/terminal.html">`) so
ghostty-web's WASM loader never has to negotiate with Next.js's bundler. The
standalone page imports `ghostty-web` from `esm.sh`, with an automatic
fallback to `xterm.js` if WASM is blocked.

## Notes

- The `ws://…/ws` endpoint hands out a real shell. **Do not expose this server
  to untrusted networks** — it's intended for local presenter use only.
- `node-pty`'s `@lydell/node-pty` fork is used because it ships prebuilt
  binaries for current macOS / Linux Node versions.
