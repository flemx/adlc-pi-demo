import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Project root = parent of presentation/ (where we run server.mjs)
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

// Hide noise from the explorer.
const HIDDEN = new Set([
  "node_modules", ".git", ".next", ".sfdx", ".sf", ".vscode",
  ".husky", "dist", "out", ".turbo", ".cache",
]);

function safeResolve(rel: string | null): string | null {
  const target = path.resolve(PROJECT_ROOT, rel || ".");
  if (target !== PROJECT_ROOT && !target.startsWith(PROJECT_ROOT + path.sep)) {
    return null;
  }
  return target;
}

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path");
  const abs = safeResolve(rel);
  if (!abs) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let stats;
  try {
    stats = await fs.stat(abs);
  } catch {
    // Folder may not exist yet (e.g. /planning before agent runs).
    return NextResponse.json({
      path: rel || "",
      absolutePath: abs,
      exists: false,
      entries: [],
    });
  }

  if (!stats.isDirectory()) {
    return NextResponse.json({ error: "not a directory" }, { status: 400 });
  }

  const dirents = await fs.readdir(abs, { withFileTypes: true });
  const entries = await Promise.all(
    dirents
      .filter((d) => !HIDDEN.has(d.name) && !d.name.startsWith("."))
      .map(async (d) => {
        const full = path.join(abs, d.name);
        const relPath = path.relative(PROJECT_ROOT, full);
        let size = 0, mtimeMs = 0;
        try {
          const s = await fs.stat(full);
          size = s.size;
          mtimeMs = s.mtimeMs;
        } catch {}
        return {
          name: d.name,
          path: relPath,
          type: d.isDirectory() ? ("dir" as const) : ("file" as const),
          size,
          mtimeMs,
        };
      }),
  );

  // dirs first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    path: path.relative(PROJECT_ROOT, abs) || "",
    absolutePath: abs,
    exists: true,
    entries,
  });
}
