import { DEFAULT_GRID_G_PER_KWH } from "./constants";
import { DEFAULT_UNIT, ENERGY_UNITS } from "./units";
import type { SummaryOptions } from "./energy";

type Raw = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/**
 * Parse a numeric query param.
 *
 * The empty string must fall back to the default, NOT be coerced: Number("")
 * is 0, which is finite, so a naive Number() check silently turns every
 * absent param into its clamp minimum. That produced a 10x understatement of
 * output energy, a zero grid factor, and a one-day window.
 */
function num(v: string, fallback: number, min: number, max: number): number {
  const s = v.trim();
  if (!s) return fallback;
  const n = Number(s);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** The display unit is a view concern, so it is read separately. */
export function readUnitId(raw: Raw): string {
  const id = one(raw.unit).trim();
  return ENERGY_UNITS.some((u) => u.id === id) ? id : DEFAULT_UNIT.id;
}

export function readOptions(
  raw: Raw,
): Required<Omit<SummaryOptions, "claudeDir">> {
  return {
    grid: num(one(raw.grid), DEFAULT_GRID_G_PER_KWH, 0, 2000),
    outputScale: num(one(raw.scale), 1, 0.1, 10),
    days: Math.round(num(one(raw.days), 30, 1, 365)),
    model: one(raw.model).slice(0, 60),
  };
}
