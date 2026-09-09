/**
 * Human units.
 *
 * A kilowatt-hour is meaningless to most readers, and a kilogram of CO2
 * equivalent is worse. So the dashboard leads with something physical and
 * keeps kWh as the secondary, auditable figure rather than the headline.
 *
 * Every unit here is a straight linear rescaling of kWh, which matters: the
 * charts keep ONE axis and one scale. Nothing is being plotted against a
 * second y-axis.
 *
 * Each unit states the rating it rests on so a reader can check it. These are
 * nameplate appliance ratings, not survey statistics, and not measurements of
 * your own devices.
 */

export type EnergyUnit = {
  id: string;
  /** Short name for an axis or a table header. */
  short: string;
  /** Full name for prose. */
  label: string;
  /** What the reader pictures, singular, for "running <noun> for ...". */
  noun: string;
  /** Plural, for count-based units: "256 full phone charges". */
  plural: string;
  /** kWh consumed by one unit. */
  kwhPer: number;
  /** True when one unit is an hour of running, so spans can be humanised. */
  timeBased: boolean;
  basis: string;
};

export const ENERGY_UNITS: EnergyUnit[] = [
  {
    id: "bulb",
    plural: "hours of a 10 W LED bulb",
    short: "bulb-hours",
    label: "hours of a 10 W LED bulb",
    noun: "a 10 W LED bulb",
    kwhPer: 0.01,
    timeBased: true,
    basis: "10 W, so 100 hours per kWh",
  },
  {
    id: "fan",
    plural: "hours of a ceiling fan",
    short: "fan-hours",
    label: "hours of a ceiling fan",
    noun: "a ceiling fan",
    kwhPer: 0.075,
    timeBased: true,
    basis: "75 W, so 13.3 hours per kWh",
  },
  {
    id: "ac",
    plural: "hours of a 1.5 ton air conditioner",
    short: "AC-hours",
    label: "hours of a 1.5 ton air conditioner",
    noun: "a 1.5 ton air conditioner",
    kwhPer: 1.5,
    timeBased: true,
    basis: "about 1,500 W, so 0.67 hours per kWh",
  },
  {
    id: "phone",
    plural: "full phone charges",
    short: "phone charges",
    label: "full phone charges",
    noun: "a phone charge",
    kwhPer: 0.015,
    timeBased: false,
    basis: "a 4,000 mAh battery at 3.85 V plus charging losses, about 15 Wh",
  },
  {
    id: "kwh",
    plural: "kilowatt-hours",
    short: "kWh",
    label: "kilowatt-hours",
    noun: "a kilowatt-hour",
    kwhPer: 1,
    timeBased: false,
    basis: "the raw unit: 1,000 watts drawn for one hour",
  },
];

export const DEFAULT_UNIT = ENERGY_UNITS[0];

export function unitById(id: string | undefined): EnergyUnit {
  return ENERGY_UNITS.find((u) => u.id === id) || DEFAULT_UNIT;
}

/**
 * Carbon anchor: distance in an average petrol car.
 *
 * Driving is the one carbon comparison nearly everyone has intuitions for.
 * 150 g CO2 per km is a defensible average for a petrol car; efficient small
 * cars are nearer 110 and large ones exceed 200, so treat it as a
 * middle-of-the-road figure rather than a precise one.
 */
export const CO2_PER_KM_KG = 0.15;
export const CO2_ANCHOR_BASIS =
  "an average petrol car at about 150 g CO2e per km";

export function co2Km(kg: number): number {
  return kg / CO2_PER_KM_KG;
}

/** Plain count in the unit, for axes and tables. */
export function inUnit(kwh: number, u: EnergyUnit): number {
  return kwh / u.kwhPer;
}

/** Compact number for an axis tick. */
export function tick(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return n.toFixed(0);
  if (n >= 1) return n.toFixed(1);
  if (n === 0) return "0";
  return n.toFixed(2);
}

/** A count a reader can picture: minutes, hours, days, months. */
export function span(n: number, u: EnergyUnit): string {
  if (!Number.isFinite(n)) return "–";
  if (!u.timeBased) {
    if (n === 0) return "0";
    if (n < 1) return n.toFixed(2);
    if (n < 10) return n.toFixed(1);
    return Math.round(n).toLocaleString("en-GB");
  }
  const hours = n;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 60) return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
  const months = days / 30.44;
  return `${months < 10 ? months.toFixed(1) : Math.round(months)} months`;
}

/** "3 days to 2 months", collapsing a shared unit where possible. */
export function spanRange(lo: number, hi: number, u: EnergyUnit): string {
  const a = span(lo, u);
  const b = span(hi, u);
  const ua = a.replace(/^[\d.,]+\s*/, "");
  const ub = b.replace(/^[\d.,]+\s*/, "");
  if (ua && ua === ub) {
    return `${a.replace(/\s*\D+$/, "")}–${b}`;
  }
  return `${a} to ${b}`;
}


/**
 * The energy restated as a clause that reads as English.
 *
 * Time-based units want "running a ceiling fan for 2 days"; count-based units
 * want "256 full phone charges". Forcing one shape on both produced
 * "running a kilowatt-hour for 3.8 to 58", which is nonsense.
 */
export function clause(lo: number, hi: number, u: EnergyUnit): string {
  const range = spanRange(lo, hi, u);
  return u.timeBased
    ? `running ${u.noun} for ${range}`
    : `${range} ${u.plural}`;
}
