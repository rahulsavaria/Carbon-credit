import { fmtKwh, fmtInt, fmtTokens } from "@/lib/format";
import { co2Km, inUnit, span } from "@/lib/units";

/** "<1 km" rather than a bare 0, which reads as missing data. */
function km(v: number): string {
  if (v < 1) return "<1 km";
  return `${Math.round(v).toLocaleString("en-GB")} km`;
}
import type { EnergyUnit } from "@/lib/units";
import type { Bands } from "@/lib/constants";

type Row = {
  name: string;
  kwh: Bands;
  co2Kg: Bands;
  totalTokens: number;
  requests: number;
};

/**
 * The table view. Required, not optional: it carries the exact figures the
 * charts only approximate, and it is the accessible path to the same data.
 *
 * The first three value columns follow the unit the reader selected, so the
 * table and the chart above it never disagree about what is being measured.
 * kWh stays as one column, because it is the auditable figure and dropping it
 * entirely would make the numbers uncheckable.
 */
/**
 * Claude Code encodes the project path into the directory name, so a project
 * arrives as "-home-alex-code-my-project". Showing that to a reader is
 * needless noise; the raw value stays available as a tooltip.
 */
function pretty(name: string): string {
  const stripped = name.replace(/^-/, "");
  const trimmed = stripped.replace(
    /^(var-www-html|home-[^-]+|opt|srv|usr-local|tmp)-/,
    "",
  );
  return trimmed || stripped;
}

export default function BandTable({
  rows,
  firstHeader,
  caption,
  unit,
}: {
  rows: Row[];
  firstHeader: string;
  caption: string;
  unit: EnergyUnit;
}) {
  if (!rows.length) return null;
  const showKwh = unit.id !== "kwh";
  return (
    <div className="tablewrap">
      <table>
        <caption className="sr">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{firstHeader}</th>
            <th scope="col">lowest</th>
            <th scope="col">middle</th>
            <th scope="col">highest</th>
            {showKwh ? <th scope="col">kWh (mid)</th> : null}
            <th scope="col">like driving (mid)</th>
            <th scope="col">tokens</th>
            <th scope="col">requests</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="name" title={r.name}>
                {pretty(r.name)}
              </td>
              <td>{span(inUnit(r.kwh.low, unit), unit)}</td>
              <td>{span(inUnit(r.kwh.mid, unit), unit)}</td>
              <td>{span(inUnit(r.kwh.high, unit), unit)}</td>
              {showKwh ? <td>{fmtKwh(r.kwh.mid)}</td> : null}
              <td>{km(co2Km(r.co2Kg.mid))}</td>
              <td>{fmtTokens(r.totalTokens)}</td>
              <td>{r.requests ? fmtInt(r.requests) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
