import { fmtKwh, fmtTokens, fmtInt } from "@/lib/format";
import { co2Km, inUnit, span, spanRange } from "@/lib/units";
import type { EnergyUnit } from "@/lib/units";
import type { Bands } from "@/lib/constants";

type Props = {
  label: string;
  kwh: Bands;
  co2Kg: Bands;
  totalTokens: number;
  requests: number;
  unit: EnergyUnit;
  extra?: string;
};

/**
 * The headline is the human equivalent, not the kilowatt-hour, because kWh is
 * the number the reader cannot picture. kWh and CO2 stay visible underneath
 * as the auditable figures.
 *
 * The band is also drawn, not just written. A range printed as "0.4-6.1"
 * reads as two facts; a bar reads as one uncertain quantity, which is what it
 * actually is.
 */
export default function StatTile({
  label,
  kwh,
  co2Kg,
  totalTokens,
  requests,
  unit,
  extra,
}: Props) {
  const lo = inUnit(kwh.low, unit);
  const mid = inUnit(kwh.mid, unit);
  const hi = inUnit(kwh.high, unit);
  // Scaled to this tile's own high: the bar's job is to show how wide the
  // uncertainty is and where the middle sits inside it, not to compare
  // periods. Comparison across periods is what the charts below are for.
  const max = Math.max(hi, 1e-9);
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="hero">{spanRange(lo, hi, unit)}</div>
      <div className="heronote">
        {unit.timeBased ? `of ${unit.noun}` : unit.plural}
      </div>

      <div
        className="bandbar"
        role="img"
        aria-label={`Range ${spanRange(lo, hi, unit)}, middle estimate ${span(
          mid,
          unit,
        )}`}
      >
        <span className="bandbar-track" />
        <span
          className="bandbar-fill"
          style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }}
        />
        <span className="bandbar-mid" style={{ left: pct(mid) }} />
      </div>
      <div className="bandbar-legend">
        <span>lowest plausible</span>
        <span>tick = middle</span>
        <span>highest</span>
      </div>

      <div className="foot">
        <div className="footrow">
          <span>Electricity</span>
          <b>
            {fmtKwh(kwh.low)}–{fmtKwh(kwh.high)} kWh
          </b>
        </div>
        <div className="footrow">
          <span>Carbon, like driving</span>
          <b>
            {Math.round(co2Km(co2Kg.low)).toLocaleString("en-GB")}–
            {Math.round(co2Km(co2Kg.high)).toLocaleString("en-GB")} km
          </b>
        </div>
        <div className="footrow">
          <span>Tokens</span>
          <b>
            {fmtTokens(totalTokens)} · {fmtInt(requests)} req
          </b>
        </div>
        {extra ? (
          <div className="footrow">
            <span>{extra}</span>
            <b />
          </div>
        ) : null}
      </div>
    </div>
  );
}
