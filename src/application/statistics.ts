import type { Trend } from "../domain/recovery";

export const MIN_TREND_COVERAGE = 0.6;
export const DEFAULT_TREND_THRESHOLD = 0.05;

export function finiteValues(values: readonly (number | undefined)[]): number[] {
  return values.filter((value): value is number => value !== undefined && Number.isFinite(value));
}

export function average(values: readonly (number | undefined)[]): number | undefined {
  const available = finiteValues(values);
  if (available.length === 0) return undefined;
  return available.reduce((total, value) => total + value, 0) / available.length;
}

export function coverage(values: readonly (number | undefined)[], requestedDays: number): number {
  if (requestedDays <= 0) return 0;
  return finiteValues(values).length / requestedDays;
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function relativeTrend(
  current: number | undefined,
  baseline: number | undefined,
  currentCoverage: number,
  baselineCoverage: number,
  higherIsBetter: boolean,
  threshold = DEFAULT_TREND_THRESHOLD,
): Trend {
  if (
    current === undefined ||
    baseline === undefined ||
    baseline === 0 ||
    currentCoverage < MIN_TREND_COVERAGE ||
    baselineCoverage < MIN_TREND_COVERAGE
  ) {
    return "unknown";
  }
  const relativeChange = (current - baseline) / Math.abs(baseline);
  if (Math.abs(relativeChange) < threshold) return "stable";
  const increased = relativeChange > 0;
  return increased === higherIsBetter ? "improving" : "declining";
}
