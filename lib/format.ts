export function fmtKwh(v: number): string {
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}

/** Watt-hours for small values, so a quiet day is not a row of zeros. */
export function fmtEnergy(kwh: number): { value: string; unit: string } {
  if (kwh > 0 && kwh < 0.1) return { value: (kwh * 1000).toFixed(0), unit: "Wh" };
  return { value: fmtKwh(kwh), unit: "kWh" };
}

export function fmtBandEnergy(low: number, high: number): string {
  if (high > 0 && high < 0.1) {
    return `${(low * 1000).toFixed(0)}–${(high * 1000).toFixed(0)} Wh`;
  }
  return `${fmtKwh(low)}–${fmtKwh(high)} kWh`;
}

export function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function fmtInt(n: number): string {
  return n.toLocaleString("en-GB");
}
