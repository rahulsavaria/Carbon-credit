/**
 * In-memory memo for the transcript parse, invalidated when any transcript
 * changes size or mtime. Reading 50+ MB of JSONL on every request would make
 * the page sluggish; a stat() sweep is cheap.
 */
import fs from "node:fs";
import path from "node:path";
import { buildSummary, claudeProjectsDir } from "./energy";
import type { Summary, SummaryOptions } from "./energy";

type Cached = { key: string; value: Summary | { error: string; projectsDir: string } };
let cached: Cached | null = null;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(full);
  }
  return out.sort();
}

function signature(opts: SummaryOptions): string {
  const parts: string[] = [
    `grid=${opts.grid}`,
    `scale=${opts.outputScale}`,
    `days=${opts.days}`,
    `model=${opts.model || ""}`,
  ];
  for (const f of walk(claudeProjectsDir(opts.claudeDir))) {
    try {
      const st = fs.statSync(f);
      parts.push(`${f}:${st.size}:${Math.floor(st.mtimeMs)}`);
    } catch {
      /* file vanished mid-sweep; ignore */
    }
  }
  return parts.join("|");
}

export async function getSummary(opts: SummaryOptions) {
  const key = signature(opts);
  if (cached && cached.key === key) return cached.value;
  const value = await buildSummary(opts);
  cached = { key, value };
  return value;
}
