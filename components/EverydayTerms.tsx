/**
 * Restates the energy bands as physical things. Each row keeps the band: a
 * single equivalent would imply a precision the coefficients do not support.
 */

import { ANCHORS, countFor, fmtCount } from "@/lib/anchors";
import { CO2_ANCHOR_BASIS, co2Km } from "@/lib/units";
import type { Bands } from "@/lib/constants";

type Period = { label: string; kwh: Bands; co2Kg: Bands };

export default function EverydayTerms({ periods }: { periods: Period[] }) {
  return (
    <>
      <div className="banner" style={{ borderLeftColor: "var(--series-1)" }}>
        <b>What a kilowatt-hour is.</b> One kWh is 1,000 watts drawn for one
        hour. So one kWh runs a 10 W LED bulb for 100 hours, or a 60 W filament
        bulb for about 17 hours. Background on the unit:{" "}
        <a
          href="https://en.wikipedia.org/wiki/Kilowatt-hour"
          target="_blank"
          rel="noreferrer noopener"
        >
          what a kilowatt-hour is
        </a>{" "}
        and{" "}
        <a
          href="https://www.eia.gov/energyexplained/units-and-calculators/"
          target="_blank"
          rel="noreferrer noopener"
        >
          how energy units convert
        </a>
        .
      </div>
      <div className="tablewrap">
        <table>
          <caption className="sr">
            Estimated energy restated as everyday equivalents, low to high band
          </caption>
          <thead>
            <tr>
              <th scope="col">Equivalent to</th>
              {periods.map((p) => (
                <th scope="col" key={p.label}>
                  {p.label}
                </th>
              ))}
              <th scope="col">Based on</th>
            </tr>
          </thead>
          <tbody>
            {ANCHORS.map((a) => (
              <tr key={a.label}>
                <td className="name">{a.label}</td>
                {periods.map((p) => (
                  <td key={p.label}>
                    {fmtCount(countFor(p.kwh.low, a), a)}–
                    {fmtCount(countFor(p.kwh.high, a), a)}{" "}
                    <span style={{ color: "var(--text-muted)" }}>{a.unit}</span>
                  </td>
                ))}
                <td
                  style={{
                    textAlign: "left",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    maxWidth: 300,
                    whiteSpace: "normal",
                  }}
                >
                  {a.basis}
                </td>
              </tr>
            ))}
            <tr>
              <td className="name">Driving a petrol car</td>
              {periods.map((p) => (
                <td key={p.label}>
                  {Math.round(co2Km(p.co2Kg.low)).toLocaleString("en-GB")}–
                  {Math.round(co2Km(p.co2Kg.high)).toLocaleString("en-GB")}{" "}
                  <span style={{ color: "var(--text-muted)" }}>km</span>
                </td>
              ))}
              <td
                style={{
                  textAlign: "left",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  whiteSpace: "normal",
                }}
              >
                carbon rather than energy: {CO2_ANCHOR_BASIS}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="meta" style={{ marginTop: 10 }}>
        Each cell is a range because the underlying energy figure is a range.
        These are ordinary appliance ratings, not measurements of your own
        devices, and they convert the estimate rather than adding any new
        precision to it.
      </p>
    </>
  );
}
