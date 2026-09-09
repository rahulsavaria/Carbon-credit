import { fmtKwh, fmtTokens } from "@/lib/format";
import { clause, co2Km, inUnit } from "@/lib/units";
import type { EnergyUnit } from "@/lib/units";
import type { Bucket } from "@/lib/constants";

/**
 * One sentence, in words, before any chart. A reader who looks at nothing
 * else should still leave with the right idea, including the fact that it is
 * a range rather than a measurement.
 */
export default function PlainLead({
  today,
  allTime,
  unit,
  requests,
}: {
  today: Bucket;
  allTime: Bucket;
  unit: EnergyUnit;
  requests: number;
}) {
  const t = clause(
    inUnit(today.kwh.low, unit),
    inUnit(today.kwh.high, unit),
    unit,
  );
  const a = clause(
    inUnit(allTime.kwh.low, unit),
    inUnit(allTime.kwh.high, unit),
    unit,
  );
  return (
    <div className="lead">
      <p className="big">
        Everything you have asked Claude Code to do on this machine has used
        about as much electricity as <b>{a}</b>. Today alone, <b>{t}</b>.
      </p>
      <p className="sub">
        That is {fmtKwh(allTime.kwh.low)}–{fmtKwh(allTime.kwh.high)} kWh across{" "}
        {requests.toLocaleString("en-GB")} requests and{" "}
        {fmtTokens(allTime.totalTokens)} tokens, and roughly the carbon of
        driving{" "}
        {Math.round(co2Km(allTime.co2Kg.low)).toLocaleString("en-GB")}–
        {Math.round(co2Km(allTime.co2Kg.high)).toLocaleString("en-GB")} km in a
        petrol car. It is a range, not a measurement, because the energy per
        token is estimated rather than published.
      </p>
    </div>
  );
}
