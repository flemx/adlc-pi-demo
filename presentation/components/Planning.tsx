"use client";

import * as React from "react";
import { marked } from "marked";

type Entry = {
  name: string;
  path: string;
  type: "dir" | "file";
  size: number;
  mtimeMs: number;
};

type Listing = {
  path: string;
  exists: boolean;
  entries: Entry[];
};

type FileBody = {
  path: string;
  size: number;
  mtimeMs: number;
  binary: boolean;
  extension?: string;
  content: string | null;
};

const PLANNING_PATH = "planning";

// ── data hooks ──────────────────────────────────────────────────────────────

async function fetchListing(p: string): Promise<Listing> {
  const r = await fetch(`/api/files?path=${encodeURIComponent(p)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`list ${p}: ${r.status}`);
  return r.json();
}

async function fetchFile(p: string): Promise<FileBody> {
  const r = await fetch(`/api/files/content?path=${encodeURIComponent(p)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`read ${p}: ${r.status}`);
  return r.json();
}

// ── tree node ───────────────────────────────────────────────────────────────

function fileIcon(name: string, type: "dir" | "file") {
  if (type === "dir") return "▸";
  const ext = name.toLowerCase().split(".").pop();
  switch (ext) {
    case "html": case "htm": return "◐";
    case "md":   return "✎";
    case "json": return "{ }";
    case "agent": return "✦";
    case "cls":  return "λ";
    case "xml":  return "<>";
    case "ts": case "tsx": case "js": case "jsx": return "ƒ";
    default:     return "·";
  }
}

type TreeProps = {
  rootPath: string;
  initiallyExpanded: Set<string>;
  selectedPath: string | null;
  onSelect: (p: string, type: "dir" | "file") => void;
  onWatchPaths: (paths: string[]) => void;
  /** Listings keyed by directory path, kept in state at the parent. */
  listings: Map<string, Entry[]>;
  expanded: Set<string>;
  onToggle: (p: string, openedNow: boolean) => Promise<void>;
};

function TreeNode({
  entry,
  depth,
  ...rest
}: TreeProps & { entry: Entry; depth: number }) {
  const { selectedPath, onSelect, listings, expanded, onToggle } = rest;
  const isOpen = expanded.has(entry.path);
  const isSel = selectedPath === entry.path;
  const children = listings.get(entry.path) || [];

  return (
    <>
      <div
        className={`tree-row ${isSel ? "sel" : ""} ${entry.type}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          if (entry.type === "dir") {
            onToggle(entry.path, !isOpen);
          } else {
            onSelect(entry.path, "file");
          }
        }}
        title={entry.path}
      >
        <span className="tree-caret">
          {entry.type === "dir" ? (isOpen ? "▾" : "▸") : ""}
        </span>
        <span className={`tree-icon icon-${entry.type}`}>{fileIcon(entry.name, entry.type)}</span>
        <span className="tree-name">{entry.name}</span>
        {entry.type === "file" && entry.size > 0 && (
          <span className="tree-size mono muted">{formatSize(entry.size)}</span>
        )}
      </div>
      {entry.type === "dir" && isOpen && children.map((c) => (
        <TreeNode
          key={c.path}
          entry={c}
          depth={depth + 1}
          {...rest}
        />
      ))}
    </>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── main component ──────────────────────────────────────────────────────────

type Props = { active: boolean };

export function Planning({ active }: Props) {
  const [listings, setListings] = React.useState<Map<string, Entry[]>>(() => new Map());
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set([PLANNING_PATH]));
  const [selected, setSelected] = React.useState<string | null>(null);
  const [body, setBody] = React.useState<FileBody | null>(null);
  const [bodyError, setBodyError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const [root, plan] = await Promise.all([fetchListing(""), fetchListing(PLANNING_PATH)]);
      setListings((prev) => {
        const next = new Map(prev);
        next.set("", root.entries);
        next.set(PLANNING_PATH, plan.entries);
        // Refresh any other directories we already had open so they stay current.
        for (const dir of prev.keys()) {
          if (dir === "" || dir === PLANNING_PATH) continue;
          // best-effort — don't await per-dir to keep the refresh snappy
          fetchListing(dir).then((l) => {
            setListings((p) => {
              const m = new Map(p);
              m.set(dir, l.entries);
              return m;
            });
          }).catch(() => {});
        }
        return next;
      });
    } catch (err) {
      console.warn("[planning] reload failed", err);
    }
  }, []);

  // Initial load: root + planning, with planning expanded.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [root, plan] = await Promise.all([fetchListing(""), fetchListing(PLANNING_PATH)]);
        if (cancelled) return;
        setListings((prev) => {
          const next = new Map(prev);
          next.set("", root.entries);
          next.set(PLANNING_PATH, plan.entries);
          return next;
        });
      } catch (err) {
        console.warn("[planning] initial load failed", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = React.useCallback(async (p: string, openedNow: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (openedNow) next.add(p); else next.delete(p);
      return next;
    });
    if (openedNow && !listings.has(p)) {
      try {
        const l = await fetchListing(p);
        setListings((prev) => {
          const next = new Map(prev);
          next.set(p, l.entries);
          return next;
        });
      } catch (err) {
        console.warn("[planning] expand failed", p, err);
      }
    }
  }, [listings]);

  const select = React.useCallback((p: string) => {
    setSelected(p);
  }, []);

  // Load the selected file body whenever selection changes.
  React.useEffect(() => {
    if (!selected) { setBody(null); setBodyError(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const b = await fetchFile(selected);
        if (cancelled) return;
        setBody(b);
        setBodyError(null);
      } catch (e: any) {
        if (cancelled) return;
        setBody(null);
        setBodyError(e?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const rootEntries = listings.get("") || [];

  return (
    <div className="plan-panel">
      <div className="plan-head">
        <h2>Project workspace</h2>
        <span className="path mono">~/agentforce/</span>
        <div className="actions">
          <button
            className="btn"
            onClick={async () => {
              await reload();
              if (selected) {
                try { setBody(await fetchFile(selected)); } catch {}
              }
            }}
            title="Refresh listings and reload the selected file"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      <div className="plan-body">
        <aside className="plan-tree">
          <div className="plan-section">
            <span className="plan-section-eye">PROJECT</span>
            <span className="plan-section-name mono">agentforce/</span>
          </div>
          <div className="plan-tree-list">
            {rootEntries.length === 0 && (
              <div className="muted" style={{ padding: 12, fontSize: 12 }}>loading…</div>
            )}
            {rootEntries.map((e) => (
              <TreeNode
                key={e.path}
                entry={e}
                depth={0}
                rootPath=""
                initiallyExpanded={new Set([PLANNING_PATH])}
                selectedPath={selected}
                onSelect={select}
                onWatchPaths={() => {}}
                listings={listings}
                expanded={expanded}
                onToggle={toggle}
              />
            ))}
          </div>
          <div className="plan-foot">
            <span className="muted" style={{ fontSize: 11 }}>
              click <b>↺ Refresh</b> after pi writes a new file
            </span>
          </div>
        </aside>

        <section className="plan-view">
          {!selected && (
            <div className="plan-empty">
              <div>
                <div className="eyebrow"><span className="pulse" /> Pick a file</div>
                <h3 style={{ marginTop: 12, color: "var(--fg-0)" }}>
                  Files generated by <span className="mono">pi</span> will appear here.
                </h3>
                <p className="muted" style={{ marginTop: 8, maxWidth: 540 }}>
                  When the planning agent finishes its analysis, the resulting{" "}
                  <span className="mono">.html</span> report will pop up
                  automatically and render on the right.
                </p>
              </div>
            </div>
          )}

          {selected && bodyError && (
            <div className="plan-empty">
              <div>
                <div className="eyebrow" style={{ color: "var(--pink)" }}>load error</div>
                <pre className="mono" style={{ marginTop: 8 }}>{bodyError}</pre>
              </div>
            </div>
          )}

          {selected && body && <FileViewer body={body} />}
        </section>
      </div>
    </div>
  );
}

// ── viewer ──────────────────────────────────────────────────────────────────

function FileViewer({ body }: { body: FileBody }) {
  const ext = body.extension || "";
  const isHtml = ext === ".html" || ext === ".htm";
  const isMd = ext === ".md";

  if (body.binary) {
    return <div className="plan-empty"><div className="muted">binary file ({formatSize(body.size)})</div></div>;
  }

  if (isHtml) {
    return (
      <div className="viewer">
        <ViewerHeader body={body} mode="HTML preview" />
        <iframe
          className="viewer-html"
          srcDoc={body.content || ""}
          title={body.path}
          sandbox="allow-same-origin allow-popups"
        />
      </div>
    );
  }

  if (isMd) {
    const html = marked.parse(body.content || "", { async: false }) as string;
    return (
      <div className="viewer">
        <ViewerHeader body={body} mode="Markdown preview" />
        <div className="viewer-md md-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div className="viewer">
      <ViewerHeader body={body} mode={`text · ${ext || "plain"}`} />
      <pre className="viewer-text mono">{body.content}</pre>
    </div>
  );
}

function ViewerHeader({ body, mode }: { body: FileBody; mode: string }) {
  return (
    <div className="viewer-head">
      <span className="path mono">{body.path}</span>
      <span className="chip"><b>{mode}</b></span>
      <span className="muted mono" style={{ fontSize: 11 }}>
        {formatSize(body.size)} · updated {new Date(body.mtimeMs).toLocaleTimeString()}
      </span>
    </div>
  );
}
