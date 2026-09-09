"use client";

/**
 * Daily estimated energy as an uncertainty BAND over time.
 *
 * The y-axis is labelled in the human unit the reader chose, not in kWh,
 * because an axis in kWh is unreadable to anyone who does not already think
 * in kWh. It is still ONE axis and one scale: the unit is a straight linear
 * rescaling, not a second series plotted against a second axis.
 *
 * The band is low-to-high as a wash; the mid is a 2px line. Both are drawn
 * deliberately, because collapsing this to one number would overstate what
 * the coefficients support. A quiet day is a real zero, not missing data, so
 * the area is continuous rather than broken at gaps.
 */

import { useMemo, useState } from "react";
import { fmtKwh, fmtInt, fmtTokens } from "@/lib/format";
import { co2Km, inUnit, spanRange, tick } from "@/lib/units";
import type { EnergyUnit } from "@/lib/units";

export type DailyPoint = {
  date: string;
  weekday: string;
  kwh: { low: number; mid: number; high: number };
  co2Kg: { low: number; mid: number; high: number };
  totalTokens: number;
  requests: number;
};

const W = 940;
const H = 280;
const PAD = { top: 30, right: 16, bottom: 34, left: 66 };

export default function DailyBandChart({
  points,
  unit,
}: {
  points: DailyPoint[];
  unit: EnergyUnit;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;

  const max = useMemo(
    () => Math.max(...points.map((p) => inUnit(p.kwh.high, unit)), 1e-9),
    [points, unit],
  );

  const ticks = useMemo(
    () => [0, 1, 2, 3, 4].map((i) => (max * i) / 4),
    [max],
  );

  if (!points.length) {
    return <div className="panel">No dated activity yet.</div>;
  }

  const v = (p: DailyPoint, b: "low" | "mid" | "high") =>
    inUnit(p.kwh[b], unit);
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (n: number) => PAD.top + ih - (n / max) * ih;

  const bandPath =
    points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(v(p, "high"))}`).join(" ") +
    " " +
    points
      .slice()
      .reverse()
      .map((p, ri) => `L${x(points.length - 1 - ri)},${y(v(p, "low"))}`)
      .join(" ") +
    " Z";

  const midPath = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(v(p, "mid"))}`)
    .join(" ");

  const labelStep = Math.max(1, Math.ceil(points.length / 10));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((rel - PAD.left) / iw) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, idx)));
  };

  const hp = hover === null ? null : points[hover];

  return (
    <div className="panel">
      <div className="chartscroll" style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Estimated energy per day in ${unit.short}, low to high band, ${points.length} days`}
          style={{
            display: "block",
            width: "100%",
            minWidth: 640,
            height: "auto",
            touchAction: "none",
          }}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {tick(t)}
              </text>
            </g>
          ))}
          <text
            x={PAD.left - 10}
            y={PAD.top - 14}
            textAnchor="end"
            fontSize={10.5}
            fill="var(--text-muted)"
          >
            {unit.short}
          </text>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + ih}
            y2={PAD.top + ih}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          <path d={bandPath} fill="var(--series-1-wash-strong)" stroke="none" />
          <path
            d={midPath}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((p, i) =>
            i % labelStep === 0 || i === points.length - 1 ? (
              <text
                key={p.date}
                x={x(i)}
                y={H - 12}
                textAnchor="middle"
                fontSize={11}
                fill="var(--text-muted)"
              >
                {p.date.slice(5)}
              </text>
            ) : null,
          )}

          {hp && hover !== null && (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + ih}
                stroke="var(--series-1)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {(["high", "mid", "low"] as const).map((b) => (
                <circle
                  key={b}
                  cx={x(hover)}
                  cy={y(v(hp, b))}
                  r={4.5}
                  fill="var(--series-1)"
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>

        {hp && hover !== null && (
          <div
            className="tip"
            style={{
              left: `min(calc(100% - 200px), ${(x(hover) / W) * 100}%)`,
              top: 4,
            }}
          >
            <div className="tip-h">
              {hp.date} · {hp.weekday}
            </div>
            <div className="tip-r">
              <span>{unit.short}</span>
              <b>
                {spanRange(inUnit(hp.kwh.low, unit), inUnit(hp.kwh.high, unit), unit)}
              </b>
            </div>
            <div className="tip-r">
              <span>electricity</span>
              <b>
                {fmtKwh(hp.kwh.low)}–{fmtKwh(hp.kwh.high)} kWh
              </b>
            </div>
            <div className="tip-r">
              <span>like driving</span>
              <b>
                {Math.round(co2Km(hp.co2Kg.low))}–
                {Math.round(co2Km(hp.co2Kg.high))} km
              </b>
            </div>
            <div className="tip-r">
              <span>tokens</span>
              <b>{fmtTokens(hp.totalTokens)}</b>
            </div>
            <div className="tip-r">
              <span>requests</span>
              <b>{fmtInt(hp.requests)}</b>
            </div>
          </div>
        )}
      </div>

      <div className="legend">
        <span>
          <span className="keyband" />
          lowest to highest plausible
        </span>
        <span>
          <span className="keyline" />
          middle estimate
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          height is {unit.label}; hover a day for the detail
        </span>
      </div>
    </div>
  );
}
