// Custom Next.js server that also exposes a WebSocket /ws endpoint
// brokering a node-pty session (running `pi` inside the parent SFDX
// project root) for the embedded ghostty-web terminal.
//
// Run:  npm run dev   (PORT=3000 by default)

import { createServer } from 'node:http';
import { parse } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import * as pty from '@lydell/node-pty';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);

// Spawn `pi` in the SFDX project root (parent of presentation/)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SHELL_CMD = process.env.PI_CMD || 'pi';
const SHELL_ARGS = (process.env.PI_ARGS || '').split(' ').filter(Boolean);

console.log(`[pty] cwd  : ${PROJECT_ROOT}`);
console.log(`[pty] cmd  : ${SHELL_CMD} ${SHELL_ARGS.join(' ')}`);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  try {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  } catch (err) {
    console.error('[next] request error', err);
    res.statusCode = 500;
    res.end('internal error');
  }
});

// WebSocket: ws://host/ws?cols=N&rows=N
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url || '', true);
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const { query } = parse(req.url || '', true);
  const cols = Math.max(20, parseInt(String(query.cols || '120'), 10) || 120);
  const rows = Math.max(10, parseInt(String(query.rows || '32'), 10) || 32);

  console.log(`[pty] connection ${cols}x${rows}`);

  let term;
  try {
    term = pty.spawn(SHELL_CMD, SHELL_ARGS, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Ensure pi sees a real terminal session
        FORCE_COLOR: '1',
      },
    });
  } catch (err) {
    console.error('[pty] spawn failed', err);
    ws.send(`\r\n\x1b[31mFailed to launch '${SHELL_CMD}': ${err.message}\x1b[0m\r\n`);
    ws.send(`\r\n\x1b[33mIs the 'pi' CLI installed and on PATH?\x1b[0m\r\n`);
    ws.close();
    return;
  }

  // PTY -> client
  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });

  term.onExit(({ exitCode, signal }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(`\r\n\x1b[2m[pi exited code=${exitCode} signal=${signal ?? 0}]\x1b[0m\r\n`);
      ws.close();
    }
  });

  // client -> PTY (raw input, or JSON control frames for resize)
  ws.on('message', (raw) => {
    const msg = raw.toString();
    if (msg.length > 0 && msg.charCodeAt(0) === 0x7b /* '{' */) {
      try {
        const ctrl = JSON.parse(msg);
        if (ctrl && ctrl.type === 'resize' && ctrl.cols && ctrl.rows) {
          term.resize(Math.max(20, ctrl.cols | 0), Math.max(10, ctrl.rows | 0));
          return;
        }
      } catch {
        // not JSON — fall through to write raw bytes
      }
    }
    term.write(msg);
  });

  ws.on('close', () => {
    try { term.kill(); } catch {}
  });

  ws.on('error', (e) => console.error('[ws] error', e));
});

httpServer.listen(port, hostname, () => {
  console.log(`\n  ▲ Headless 360 presentation`);
  console.log(`  ─ Next.js  http://localhost:${port}`);
  console.log(`  ─ PTY /ws  ws://localhost:${port}/ws  →  ${SHELL_CMD} (cwd: ${PROJECT_ROOT})\n`);
});
