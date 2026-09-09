/**
 * Transcript parsing and aggregation. SERVER ONLY: uses node:fs.
 *
 * The pure constants and math live in ./constants so client components can
 * import them without pulling node builtins into the browser bundle.
 *
 * IMPORTANT, and the whole point of this app: the token counts here are read
 * from your own machine and are exact. The joules-per-token coefficients are
 * INFERRED from public sources, because Anthropic publishes no per-token or
 * per-query energy figures for any Claude model. Every output is therefore a
 * BAND, never a single number, and it is not suitable for regulatory or
 * compliance reporting.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

import {
  COEFFICIENTS_J,
  DEFAULT_GRID_G_PER_KWH,
  TOKEN_CLASSES,
  USAGE_FIELD,
  isoWeek,
  makeBucket,
  zeroTokens,
} from "./constants";
import type { Bucket, TokenClass, Tokens } from "./constants";

export {
  BAND_KEYS,
  COEFFICIENTS_J,
  DEFAULT_GRID_G_PER_KWH,
  GRID_REFERENCE,
  TOKEN_CLASSES,
  energyKwh,
  isoWeek,
  makeBucket,
  zeroTokens,
} from "./constants";
export type { Bands, Bucket, TokenClass, Tokens } from "./constants";

function toInt(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function claudeProjectsDir(claudeDir?: string): string {
  const base =
    claudeDir ||
    process.env.CLAUDE_CONFIG_DIR ||
    path.join(os.homedir(), ".claude");
  return path.join(base.replace(/^~(?=$|\/)/, os.homedir()), "projects");
}

export function walkJsonl(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJsonl(full));
    else if (e.isFile() && e.name.endsWith(".jsonl")) out.push(full);
  }
  return out.sort();
}

export type RequestRow = {
  project: string;
  model: string;
  ts: Date | null;
  tokens: Tokens;
};

export type ParseResult = {
  rows: Map<string, RequestRow>;
  transcripts: number;
  badLines: number;
  projectsDir: string;
};

/**
 * Fold every usage record down to one row per API request.
 *
 * Two parsing pitfalls, both handled here:
 *
 * 1. Claude Code logs a `usage` object on MANY lines of a single API call, and
 *    output_tokens is a mid-stream snapshot rather than a final count. We key
 *    on requestId and keep the MAXIMUM value seen per token class. Summing
 *    every line would badly overcount; taking the first would undercount.
 *
 * 2. Dedup is GLOBAL across files, not per file. A resumed or forked session
 *    copies earlier messages into a new transcript, so the same requestId can
 *    appear in more than one file.
 *
 * Output is still undercounted regardless: a known issue
 * (anthropics/claude-code#27361) reports the final message_stop event is never
 * written, so real output may be roughly 2x what the JSONL shows. Input and
 * cache counts are accurate, being fixed at request start.
 */
export async function parseTranscripts(
  claudeDir?: string,
): Promise<ParseResult> {
  const projectsDir = claudeProjectsDir(claudeDir);
  const files = walkJsonl(projectsDir);
  const rows = new Map<string, RequestRow>();
  let badLines = 0;

  for (const file of files) {
    const project = path.basename(path.dirname(file));
    let stream: fs.ReadStream;
    try {
      stream = fs.createReadStream(file, { encoding: "utf8" });
    } catch {
      continue;
    }
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of rl) {
        const text = line.trim();
        if (!text) continue;
        let entry: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(text);
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            badLines += 1;
            continue;
          }
          entry = parsed as Record<string, unknown>;
        } catch {
          badLines += 1;
          continue;
        }

        const msg = entry.message;
        if (typeof msg !== "object" || msg === null) continue;
        const message = msg as Record<string, unknown>;
        const usage = message.usage;
        if (
          typeof usage !== "object" ||
          usage === null ||
          Array.isArray(usage)
        ) {
          continue;
        }
        const u = usage as Record<string, unknown>;

        const rid = String(
          entry.requestId || message.id || entry.uuid || "",
        ).trim();
        if (!rid) continue;

        const tokens = zeroTokens();
        for (const k of TOKEN_CLASSES) tokens[k] = toInt(u[USAGE_FIELD[k]]);

        const rawTs = entry.timestamp;
        let ts: Date | null = null;
        if (typeof rawTs === "string" && rawTs) {
          const d = new Date(rawTs);
          if (!Number.isNaN(d.getTime())) ts = d;
        }

        const model = String(message.model || entry.model || "");
        const existing = rows.get(rid);
        if (!existing) {
          rows.set(rid, { project, model, ts, tokens });
        } else {
          for (const k of TOKEN_CLASSES) {
            if (tokens[k] > existing.tokens[k]) existing.tokens[k] = tokens[k];
          }
          if (existing.ts === null && ts !== null) existing.ts = ts;
        }
      }
    } finally {
      rl.close();
      stream.close();
    }
  }

  return { rows, transcripts: files.length, badLines, projectsDir };
}

/** YYYY-MM-DD in the machine's LOCAL timezone, not UTC. */
function localDateKey(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function localParts(d: Date) {
  const key = localDateKey(d);
  const [y, m, day] = key.split("-").map(Number);
  return { key, y, m, day };
}

export function localTimezoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const offMin = -new Date().getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const a = Math.abs(offMin);
  return `${zone} ${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(
    a % 60,
  ).padStart(2, "0")}`;
}

export type DayPoint = Bucket & { date: string; weekday: string };
export type WeekPoint = Bucket & { week: string };
export type NamedPoint = Bucket & { name: string };

export type Summary = {
  generatedAt: string;
  timezone: string;
  grid: number;
  outputScale: number;
  modelFilter: string;
  days: number;
  transcripts: number;
  requests: number;
  badLines: number;
  undatedRequests: number;
  projectsDir: string;
  coefficients: Record<TokenClass, [number, number, number]>;
  today: Bucket;
  thisWeek: Bucket;
  allTime: Bucket;
  todayKey: string;
  weekKey: string;
  dailySeries: DayPoint[];
  weekly: WeekPoint[];
  projects: NamedPoint[];
  models: NamedPoint[];
};

export type SummaryOptions = {
  claudeDir?: string;
  grid?: number;
  outputScale?: number;
  days?: number;
  model?: string;
};

export async function buildSummary(
  opts: SummaryOptions = {},
): Promise<Summary | { error: string; projectsDir: string }> {
  const grid = opts.grid ?? DEFAULT_GRID_G_PER_KWH;
  const outputScale = opts.outputScale ?? 1;
  const daysBack = Math.max(1, Math.min(365, opts.days ?? 30));
  const modelFilter = (opts.model || "").toLowerCase();

  const { rows, transcripts, badLines, projectsDir } = await parseTranscripts(
    opts.claudeDir,
  );

  if (transcripts === 0) {
    return {
      error: `No Claude Code transcripts found under ${projectsDir}`,
      projectsDir,
    };
  }

  const dayTok = new Map<string, Tokens>();
  const dayReq = new Map<string, number>();
  const weekTok = new Map<string, Tokens>();
  const weekReq = new Map<string, number>();
  const projTok = new Map<string, Tokens>();
  const projReq = new Map<string, number>();
  const modelTok = new Map<string, Tokens>();
  const modelReq = new Map<string, number>();
  const allTok = zeroTokens();
  let undated = 0;
  let counted = 0;

  const bump = (
    m: Map<string, Tokens>,
    c: Map<string, number>,
    key: string,
    t: Tokens,
  ) => {
    let acc = m.get(key);
    if (!acc) {
      acc = zeroTokens();
      m.set(key, acc);
    }
    for (const k of TOKEN_CLASSES) acc[k] += t[k];
    c.set(key, (c.get(key) || 0) + 1);
  };

  for (const row of rows.values()) {
    if (modelFilter && !row.model.toLowerCase().includes(modelFilter)) continue;
    counted += 1;
    for (const k of TOKEN_CLASSES) allTok[k] += row.tokens[k];
    bump(projTok, projReq, row.project || "unknown", row.tokens);
    bump(modelTok, modelReq, row.model || "unknown", row.tokens);
    if (!row.ts) {
      undated += 1;
      continue;
    }
    const p = localParts(row.ts);
    bump(dayTok, dayReq, p.key, row.tokens);
    bump(weekTok, weekReq, isoWeek(p.y, p.m, p.day), row.tokens);
  }

  const now = new Date();
  const nowParts = localParts(now);
  const todayKey = nowParts.key;
  const weekKey = isoWeek(nowParts.y, nowParts.m, nowParts.day);

  // Dense day series so a quiet day reads as a real zero rather than a gap.
  const dailySeries: DayPoint[] = [];
  const end = new Date(`${todayKey}T00:00:00`);
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (daysBack - 1));
  while (cursor <= end) {
    const key = localDateKey(cursor);
    dailySeries.push({
      ...makeBucket(
        dayTok.get(key) || zeroTokens(),
        dayReq.get(key) || 0,
        grid,
        outputScale,
      ),
      date: key,
      weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(
        cursor,
      ),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const weekly: WeekPoint[] = [...weekTok.keys()]
    .sort()
    .slice(-12)
    .map((k) => ({
      ...makeBucket(weekTok.get(k)!, weekReq.get(k) || 0, grid, outputScale),
      week: k,
    }));

  const named = (m: Map<string, Tokens>, c: Map<string, number>) =>
    [...m.keys()]
      .map((k) => ({
        ...makeBucket(m.get(k)!, c.get(k) || 0, grid, outputScale),
        name: k,
      }))
      // Claude Code labels some internal turns <synthetic>; they carry no
      // tokens, so a zero row would be noise.
      .filter((r) => r.totalTokens > 0)
      .sort((a, b) => b.kwh.mid - a.kwh.mid);

  return {
    generatedAt: now.toISOString(),
    timezone: localTimezoneLabel(),
    grid,
    outputScale,
    modelFilter: opts.model || "",
    days: daysBack,
    transcripts,
    requests: counted,
    badLines,
    undatedRequests: undated,
    projectsDir,
    coefficients: COEFFICIENTS_J,
    today: makeBucket(
      dayTok.get(todayKey) || zeroTokens(),
      dayReq.get(todayKey) || 0,
      grid,
      outputScale,
    ),
    thisWeek: makeBucket(
      weekTok.get(weekKey) || zeroTokens(),
      weekReq.get(weekKey) || 0,
      grid,
      outputScale,
    ),
    allTime: makeBucket(allTok, counted, grid, outputScale),
    todayKey,
    weekKey,
    dailySeries,
    weekly,
    projects: named(projTok, projReq),
    models: named(modelTok, modelReq),
  };
}
