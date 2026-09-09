"use client";

/**
 * Filters in one row above the charts. A plain GET form, so the current view
 * is always a shareable URL and the page works without client-side state.
 */

import Link from "next/link";

import { GRID_REFERENCE } from "@/lib/constants";
import { ENERGY_UNITS } from "@/lib/units";
import ThemeToggle from "./ThemeToggle";

export default function Controls({
  grid,
  scale,
  days,
  model,
  unit,
}: {
  grid: number;
  scale: number;
  days: number;
  model: string;
  unit: string;
}) {
  const known = GRID_REFERENCE.some((g) => g.value === grid);
  return (
    <form className="controls" method="get">
      <div className="field">
        <label htmlFor="unit">Show energy as</label>
        <select id="unit" name="unit" defaultValue={unit}>
          {ENERGY_UNITS.map((u) => (
            <option key={u.id} value={u.id}>
              {u.short}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="grid">Grid gCO2e/kWh</label>
        <select id="grid" name="grid" defaultValue={String(grid)}>
          {!known && <option value={String(grid)}>{grid} (custom)</option>}
          {GRID_REFERENCE.map((g) => (
            <option key={g.value} value={String(g.value)}>
              {g.value} · {g.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="scale">Output scale</label>
        <select id="scale" name="scale" defaultValue={String(scale)}>
          <option value="1">1× raw transcript</option>
          <option value="2">2× undercount fix</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="days">Days shown</label>
        <select id="days" name="days" defaultValue={String(days)}>
          {[7, 14, 30, 60, 90, 180, 365].map((d) => (
            <option key={d} value={String(d)}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="model">Model contains</label>
        <input
          id="model"
          name="model"
          defaultValue={model}
          placeholder="e.g. opus"
          autoComplete="off"
        />
      </div>
      <ThemeToggle />
      <button className="btn" type="submit">
        Apply
      </button>
      <Link className="btn btn--ghost" href="/">
        Reset
      </Link>
    </form>
  );
}
