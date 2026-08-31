const DAY_MS = 86_400_000;

function partsAt(date: Date, timezone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  );
}

export function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date(0));
  } catch {
    throw new Error('ANALYTICS_REPORTING_TIMEZONE must be a valid IANA timezone');
  }
}

export function reportingDay(date: Date, timezone: string): string {
  const parts = partsAt(date, timezone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function parseDay(day: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new Error('day must use YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, date));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== date
  ) {
    throw new Error('day must be a real calendar date');
  }
  return { year, month, day: date };
}

/**
 * Resolve the first real instant belonging to a local calendar date.
 *
 * Some IANA zones advance their clock at midnight, so local 00:00 does not
 * exist. Sampling finds the first instant inside the target date and a binary
 * search then resolves its exact millisecond boundary. This also chooses the
 * earliest occurrence when midnight is repeated.
 */
export function startOfReportingDay(day: string, timezone: string): Date {
  assertValidTimezone(timezone);
  const target = parseDay(day);
  const targetUtc = Date.UTC(target.year, target.month - 1, target.day);
  const step = 30 * 60_000;
  const searchStart = targetUtc - 36 * 3_600_000;
  const searchEnd = targetUtc + 36 * 3_600_000;
  let firstSample: number | undefined;
  let priorSample = searchStart;
  for (let candidate = searchStart; candidate <= searchEnd; candidate += step) {
    if (reportingDay(new Date(candidate), timezone) === day) {
      firstSample = candidate;
      break;
    }
    priorSample = candidate;
  }
  if (firstSample === undefined) {
    throw new Error(`reporting day ${day} does not exist in timezone ${timezone}`);
  }
  let outside = priorSample;
  let inside = firstSample;
  while (inside - outside > 1) {
    const middle = outside + Math.floor((inside - outside) / 2);
    if (reportingDay(new Date(middle), timezone) === day) inside = middle;
    else outside = middle;
  }
  return new Date(inside);
}

export function addReportingDays(day: string, amount: number): string {
  const parsed = parseDay(day);
  const shifted = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + amount));
  return `${shifted.getUTCFullYear().toString().padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function reportingDayBounds(
  day: string,
  timezone: string,
): { readonly start: Date; readonly end: Date } {
  return {
    start: startOfReportingDay(day, timezone),
    end: startOfReportingDay(addReportingDays(day, 1), timezone),
  };
}

export function enumerateReportingDays(from: string, to: string): string[] {
  const first = parseDay(from);
  const last = parseDay(to);
  const start = Date.UTC(first.year, first.month - 1, first.day);
  const end = Date.UTC(last.year, last.month - 1, last.day);
  if (start > end) throw new Error('from must not be after to');
  if ((end - start) / DAY_MS > 366) throw new Error('date range cannot exceed 367 days');
  const days: string[] = [];
  for (let current = from; current <= to; current = addReportingDays(current, 1)) {
    days.push(current);
  }
  return days;
}
