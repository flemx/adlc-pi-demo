import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const MAX_BYTES = 1024 * 1024 * 2; // 2 MB

const TEXT_EXT = new Set([
  ".md", ".txt", ".html", ".htm", ".json", ".yml", ".yaml",
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".css",
  ".cls", ".trigger", ".xml", ".page", ".cmp", ".app", ".evt",
  ".agent", ".aiagent", ".aiAuthoring", ".log", ".sh", ".env.example",
]);

function safeResolve(rel: string | null): string | null {
  if (!rel) return null;
  const target = path.resolve(PROJECT_ROOT, rel);
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
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!stats.isFile()) {
    return NextResponse.json({ error: "not a file" }, { status: 400 });
  }

  if (stats.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "too large", size: stats.size, max: MAX_BYTES },
      { status: 413 },
    );
  }

  const ext = path.extname(abs).toLowerCase();
  const isText = TEXT_EXT.has(ext) || ext === "";

  if (!isText) {
    return NextResponse.json({
      path: rel,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      binary: true,
      content: null,
    });
  }

  const buf = await fs.readFile(abs);
  return NextResponse.json({
    path: rel,
    size: stats.size,
    mtimeMs: stats.mtimeMs,
    binary: false,
    extension: ext,
    content: buf.toString("utf8"),
  });
}
