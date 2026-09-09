import type { TokenClass } from "@/lib/constants";

/**
 * Where the energy goes, as one bar. The table beneath carries the exact
 * percentages; this exists so the shape is obvious without reading numbers,
 * because the shape is the actionable finding.
 *
 * Segments run in order of energy cost PER TOKEN, most expensive first, and
 * are shaded from one hue accordingly. So the darkest band in light mode is
 * the priciest token class, and the widths show how much of the total each
 * one actually accounts for. Percentages are printed in the key as well, so
 * nothing depends on colour alone.
 */
const COST_ORDER: TokenClass[] = [
  "output",
  "cache_creation",
  "input",
  "cache_read",
];
const TINT: Record<TokenClass, string> = {
  output: "var(--share-1)",
  cache_creation: "var(--share-2)",
  input: "var(--share-3)",
  cache_read: "var(--share-4)",
};
const NICE: Record<TokenClass, string> = {
  output: "output",
  cache_creation: "cache writes",
  input: "input",
  cache_read: "cache reads",
};

export default function ShareBar({
  shares,
}: {
  shares: { k: TokenClass; pct: number }[];
}) {
  const pctOf = (k: TokenClass) => shares.find((s) => s.k === k)?.pct ?? 0;
  return (
    <>
      <div
        className="sharebar"
        role="img"
        aria-label={COST_ORDER.map(
          (k) => `${NICE[k]} ${pctOf(k).toFixed(0)} percent`,
        ).join(", ")}
      >
        {COST_ORDER.map((k) => {
          const pct = pctOf(k);
          if (pct <= 0.4) return null;
          return (
            <span
              key={k}
              style={{ width: `${pct}%`, background: TINT[k] }}
              title={`${NICE[k]}: ${pct.toFixed(1)}%`}
            />
          );
        })}
      </div>
      <div className="sharekey">
        {COST_ORDER.map((k) => {
          const pct = pctOf(k);
          return (
            <span key={k}>
              <i style={{ background: TINT[k] }} />
              {NICE[k]} <b style={{ color: "var(--text-primary)" }}>
                {pct.toFixed(pct < 1 ? 1 : 0)}%
              </b>
            </span>
          );
        })}
        <span style={{ color: "var(--text-muted)" }}>
          darkest is the most energy per token; width is share of the total
        </span>
      </div>
    </>
  );
}
