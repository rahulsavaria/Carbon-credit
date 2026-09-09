"use client";

/**
 * Weekly estimated energy: columns for the mid estimate, with the low-to-high
 * band drawn as a whisker on each column.
 *
 * Columns are capped at 24px, grow from a single baseline, and carry a 4px
 * rounded top with square corners at the baseline. The whisker is what keeps
 * this honest: the column alone would read as a point estimate.
 */

import { useState } from "react";
import { fmtKwh, fmtInt, fmtTokens } from "@/lib/format";
import { co2Km, inUnit, spanRange, tick } from "@/lib/units";
import type { EnergyUnit } from "@/lib/units";

export type WeekPoint = {
  week: string;
  kwh: { low: number; mid: number; high: number };
  co2Kg: { low: number; mid: number; high: number };
  totalTokens: number;
  requests: number;
};

const H = 240;
const PAD = { top: 30, right: 16, bottom: 34, left: 66 };
const MAX_BAR = 24;
const GAP = 2;

export default function WeeklyColumns({
  points,
  unit,
}: {
  points: WeekPoint[];
  unit: EnergyUnit;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (!points.length) {
    return <div className="panel">No dated activity yet.</div>;
  }

  const slot = Math.max(46, Math.min(96, 760 / points.length));
  // Keep the viewBox wide enough that scaling to container width does not
  // stretch the panel unusably tall.
  const W = Math.max(880, PAD.left + PAD.right + slot * points.length);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const val = (p: WeekPoint, b: "low" | "mid" | "high") =>
    inUnit(p.kwh[b], unit);
  const max = Math.max(...points.map((p) => val(p, "high")), 1e-9);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const base = PAD.top + ih;
  const bw = Math.min(MAX_BAR, iw / points.length - GAP * 2);

  const ticks = [0, 1, 2, 3, 4].map((i) => (max * i) / 4);

  const barPath = (cx: number, top: number) => {
    const r = Math.min(4, bw / 2, Math.max(0, base - top));
    const l = cx - bw / 2;
    const rr = cx + bw / 2;
    return `M${l},${base} L${l},${top + r} Q${l},${top} ${l + r},${top} L${rr - r},${top} Q${rr},${top} ${rr},${top + r} L${rr},${base} Z`;
  };

  const hp = hover === null ? null : points[hover];

  return (
    <div className="panel">
      <div className="chartscroll" style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Estimated energy per ISO week in kWh, column is the mid estimate, whisker is the low to high band"
          style={{ display: "block", width: "100%", minWidth: 560, height: "auto" }}
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
            y1={base}
            y2={base}
            stroke="var(--baseline)"
            strokeWidth={1}
          />

          {points.map((p, i) => {
            const cx = PAD.left + (i + 0.5) * (iw / points.length);
            const active = hover === i;
            return (
              <g
                key={p.week}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
              >
                <rect
                  x={cx - (iw / points.length) / 2}
                  y={PAD.top}
                  width={iw / points.length}
                  height={ih}
                  fill="transparent"
                />
                <path
                  d={barPath(cx, y(val(p, "mid")))}
                  fill={active ? "var(--series-1)" : "var(--series-1-wash-strong)"}
                  stroke="var(--series-1)"
                  strokeWidth={1}
                />
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(val(p, "high"))}
                  y2={y(val(p, "low"))}
                  stroke="var(--series-1)"
                  strokeWidth={2}
                />
                <line
                  x1={cx - 5}
                  x2={cx + 5}
                  y1={y(val(p, "high"))}
                  y2={y(val(p, "high"))}
                  stroke="var(--series-1)"
                  strokeWidth={2}
                />
                <line
                  x1={cx - 5}
                  x2={cx + 5}
                  y1={y(val(p, "low"))}
                  y2={y(val(p, "low"))}
                  stroke="var(--series-1)"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={H - 12}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-muted)"
                >
                  {p.week.replace(/^\d+-/, "")}
                </text>
              </g>
            );
          })}
        </svg>

        {hp && hover !== null && (
          <div
            className="tip"
            style={{
              left: `min(calc(100% - 190px), ${((PAD.left + (hover + 0.5) * (iw / points.length)) / W) * 100}%)`,
              top: 4,
            }}
          >
            <div className="tip-h">{hp.week}</div>
            <div className="tip-r">
              <span>{unit.short}</span>
              <b>
                {spanRange(
                  inUnit(hp.kwh.low, unit),
                  inUnit(hp.kwh.high, unit),
                  unit,
                )}
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
          column: middle estimate
        </span>
        <span>
          <span className="keyline" />
          whisker: lowest to highest plausible
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          height is {unit.label}
        </span>
      </div>
    </div>
  );
}
