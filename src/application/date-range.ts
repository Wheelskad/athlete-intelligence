import type { DateRange } from "../domain/provider";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DateRangeError extends Error {
  readonly code = "INVALID_DATE_RANGE";

  constructor(message: string) {
    super(message);
    this.name = "DateRangeError";
  }
}

export function assertIsoDate(value: string, fieldName = "date"): void {
  const match = ISO_DATE.exec(value);
  if (!match) throw new DateRangeError(`${fieldName} must use ISO format YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new DateRangeError(`${fieldName} is not a valid calendar date`);
  }
}

export function addDays(date: string, amount: number): string {
  assertIsoDate(date);
  const result = new Date(`${date}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

export function periodDays(range: DateRange): number {
  assertIsoDate(range.startDate, "startDate");
  assertIsoDate(range.endDate, "endDate");
  const start = Date.parse(`${range.startDate}T00:00:00.000Z`);
  const end = Date.parse(`${range.endDate}T00:00:00.000Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function dateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function validateDateRange(
  range: DateRange,
  options: { maxDays: number; today: string; allowFuture?: boolean },
): DateRange {
  const days = periodDays(range);
  if (days < 1) throw new DateRangeError("startDate must not be after endDate");
  if (days > options.maxDays) {
    throw new DateRangeError(`Date range cannot exceed ${String(options.maxDays)} calendar days`);
  }
  if (!options.allowFuture && range.endDate > options.today) {
    throw new DateRangeError("endDate cannot be in the future for completed activities");
  }
  return range;
}

export function recentRange(endDate: string, days: number): DateRange {
  return { startDate: addDays(endDate, -(days - 1)), endDate };
}

export function previousRange(range: DateRange): DateRange {
  const days = periodDays(range);
  const endDate = addDays(range.startDate, -1);
  return recentRange(endDate, days);
}
