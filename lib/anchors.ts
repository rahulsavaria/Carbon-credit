/**
 * Everyday equivalents for a kilowatt-hour.
 *
 * kWh means nothing to most readers, so each figure is restated as something
 * physical. Every anchor states the assumption it rests on, in the row
 * itself, so a reader can check the arithmetic rather than trust it. These
 * are ordinary appliance ratings, not measurements of your own devices.
 *
 * Each anchor is "kWh consumed per one unit of the thing".
 */

export type Anchor = {
  /** Plural noun for the unit, e.g. "hours". */
  unit: string;
  /** What one unit is, shown to the reader. */
  label: string;
  /** The assumption behind the number, shown to the reader. */
  basis: string;
  /** kWh per single unit. */
  kwhPerUnit: number;
  /** Decimal places when the count is small. */
  precise?: boolean;
};

export const ANCHORS: Anchor[] = [
  {
    unit: "hours",
    label: "A 10 W LED bulb, left on",
    basis: "10 W for one hour = 0.010 kWh",
    kwhPerUnit: 0.01,
  },
  {
    unit: "hours",
    label: "A 60 W filament bulb, left on",
    basis: "60 W for one hour = 0.060 kWh",
    kwhPerUnit: 0.06,
  },
  {
    unit: "hours",
    label: "A ceiling fan, running",
    basis: "75 W for one hour = 0.075 kWh",
    kwhPerUnit: 0.075,
  },
  {
    unit: "charges",
    label: "Full phone charges",
    basis: "a 4,000 mAh battery at 3.85 V plus charging losses, about 15 Wh",
    kwhPerUnit: 0.015,
  },
  {
    unit: "litres",
    label: "Water boiled in an electric kettle",
    basis: "20 °C to 100 °C is 0.093 kWh per litre, about 0.105 kWh at 90% efficiency",
    kwhPerUnit: 0.105,
  },
  {
    unit: "days",
    label: "A domestic refrigerator, running",
    basis: "about 1.2 kWh per day",
    kwhPerUnit: 1.2,
    precise: true,
  },
];

export function countFor(kwh: number, a: Anchor): number {
  return kwh / a.kwhPerUnit;
}

export function fmtCount(n: number, a: Anchor): string {
  if (!Number.isFinite(n)) return "–";
  if (n === 0) return "0";
  if (a.precise && n < 10) return n.toFixed(1);
  if (n < 1) return n.toFixed(2);
  if (n < 10) return n.toFixed(1);
  return Math.round(n).toLocaleString("en-GB");
}
