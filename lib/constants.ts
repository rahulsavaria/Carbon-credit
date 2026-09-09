/**
 * Pure constants and math. NO node builtins in this file: it is imported by
 * client components, so anything requiring `node:fs` here would be bundled
 * for the browser and fail the build.
 */

export const TOKEN_CLASSES = [
  "output",
  "input",
  "cache_creation",
  "cache_read",
] as const;

export type TokenClass = (typeof TOKEN_CLASSES)[number];
export type Tokens = Record<TokenClass, number>;
export type Bands = { low: number; mid: number; high: number };
export const BAND_KEYS = ["low", "mid", "high"] as const;

/**
 * Joules per token, as [low, mid, high].
 *
 * THIS TABLE IS THE ONLY THING TO CHANGE if Anthropic ever discloses real
 * per-token energy figures. Four rows, nothing else in this codebase.
 *
 * Sourcing, in brief:
 *  - Google's Aug 2025 methodology puts a median Gemini text prompt at about
 *    0.24 Wh (~864 J). At a few hundred output tokens per response that
 *    implies low single-digit joules per output token.
 *  - Hardware arithmetic agrees: an 8-GPU serving node draws roughly 5-6 kW
 *    and, batched, emits on the order of 10^3 tokens/sec aggregate, times a
 *    datacenter PUE of about 1.1-1.2.
 *  - A widely-repeated third-party figure for Claude 3 Opus (~4.05 Wh/query)
 *    implies considerably more. It is not company-disclosed and its
 *    methodology is opaque, so it informs the top of the HIGH band only.
 *  - Opus-class models are larger than the Gemini model Google measured, so
 *    mid sits above the Gemini-implied figure.
 *  - Prefill (input) is heavily parallel, so per-token cost is roughly an
 *    order of magnitude below sequential decode; cache reads skip most of
 *    that work again. The ratios also roughly track Anthropic's own relative
 *    pricing of the four token classes.
 */
export const COEFFICIENTS_J: Record<TokenClass, [number, number, number]> = {
  output: [1.0, 4.0, 15.0],
  input: [0.1, 0.4, 1.5],
  cache_creation: [0.1, 0.4, 1.5],
  cache_read: [0.01, 0.04, 0.15],
};

/** Rough GLOBAL MEAN. The grid that matters is the datacenter's, not yours. */
export const DEFAULT_GRID_G_PER_KWH = 450;

export const GRID_REFERENCE = [
  { label: "Global mean", value: 450 },
  { label: "India", value: 708 },
  { label: "United States", value: 390 },
  { label: "EU", value: 250 },
  { label: "France / Nordics", value: 60 },
];

export const J_PER_KWH = 3.6e6;

export const USAGE_FIELD: Record<TokenClass, string> = {
  input: "input_tokens",
  output: "output_tokens",
  cache_creation: "cache_creation_input_tokens",
  cache_read: "cache_read_input_tokens",
};

export function zeroTokens(): Tokens {
  return { output: 0, input: 0, cache_creation: 0, cache_read: 0 };
}

export function energyKwh(tokens: Tokens, outputScale = 1): Bands {
  const out = { low: 0, mid: 0, high: 0 } as Bands;
  BAND_KEYS.forEach((band, i) => {
    let j = 0;
    for (const k of TOKEN_CLASSES) {
      const n = k === "output" ? tokens[k] * outputScale : tokens[k];
      j += n * COEFFICIENTS_J[k][i];
    }
    out[band] = j / J_PER_KWH;
  });
  return out;
}

export type Bucket = {
  tokens: Tokens;
  totalTokens: number;
  requests: number;
  kwh: Bands;
  co2Kg: Bands;
};

export function makeBucket(
  tokens: Tokens,
  requests: number,
  grid: number,
  outputScale: number,
): Bucket {
  const kwh = energyKwh(tokens, outputScale);
  return {
    tokens,
    totalTokens: TOKEN_CLASSES.reduce((s, k) => s + tokens[k], 0),
    requests,
    kwh,
    co2Kg: {
      low: (kwh.low * grid) / 1000,
      mid: (kwh.mid * grid) / 1000,
      high: (kwh.high * grid) / 1000,
    },
  };
}

/** ISO-8601 week of a local calendar date. */
export function isoWeek(y: number, m: number, d: number): string {
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
