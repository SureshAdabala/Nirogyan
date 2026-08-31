import type { PublicBiomarkerRangeContext, PublicMeasurementInterval } from '@niro/contracts';

function formatNumber(value: number): string {
  // ECMAScript's shortest decimal representation is guaranteed to round-trip
  // to the same IEEE-754 value. Locale formatting with a fixed fractional cap
  // would silently alter clinically meaningful thresholds.
  return String(value);
}

export function formatReferenceInterval(interval: PublicMeasurementInterval, unit: string): string {
  const hasMin = typeof interval.min === 'number' && Number.isFinite(interval.min);
  const hasMax = typeof interval.max === 'number' && Number.isFinite(interval.max);
  const suffix = unit ? ` ${unit}` : '';
  if (
    (hasMin && typeof interval.minInclusive !== 'boolean') ||
    (hasMax && typeof interval.maxInclusive !== 'boolean')
  ) {
    return 'Boundary inclusivity not published';
  }
  if (hasMin && hasMax) {
    if (
      interval.min === interval.max &&
      interval.minInclusive === true &&
      interval.maxInclusive === true
    ) {
      return `${formatNumber(interval.min)}${suffix}`;
    }
    const minimum = `${interval.minInclusive ? '≥' : '>'} ${formatNumber(interval.min)}`;
    const maximum = `${interval.maxInclusive ? '≤' : '<'} ${formatNumber(interval.max)}`;
    return `${minimum} and ${maximum}${suffix}`;
  }
  if (hasMin) {
    return `${interval.minInclusive ? '≥' : '>'} ${formatNumber(interval.min)}${suffix}`;
  }
  if (hasMax) {
    return `${interval.maxInclusive ? '≤' : '<'} ${formatNumber(interval.max)}${suffix}`;
  }
  return 'No numeric interval published';
}

function sentenceCase(value: string): string {
  const words = value.replaceAll('-', ' ');
  return `${words.charAt(0).toLocaleUpperCase('en-IN')}${words.slice(1)}`;
}

export function referenceContextEntries(
  context: PublicBiomarkerRangeContext,
): readonly { readonly label: string; readonly value: string }[] {
  const entries: { label: string; value: string }[] = [];
  const ageMin = context.ageMinYears;
  const ageMax = context.ageMaxYears;
  if (context.sexAtBirth)
    entries.push({ label: 'Sex at birth', value: sentenceCase(context.sexAtBirth) });
  if (ageMin !== undefined || ageMax !== undefined) {
    const value =
      ageMin !== undefined && ageMax !== undefined
        ? `${formatNumber(ageMin)} to ${formatNumber(ageMax)} years`
        : ageMin !== undefined
          ? `${formatNumber(ageMin)} years and older`
          : `Up to ${formatNumber(ageMax ?? 0)} years`;
    entries.push({ label: 'Age', value });
  }
  if (context.pregnancyStatus)
    entries.push({ label: 'Pregnancy', value: sentenceCase(context.pregnancyStatus) });
  if (context.menopausalStatus)
    entries.push({ label: 'Menopausal status', value: sentenceCase(context.menopausalStatus) });
  if (context.fastingStatus)
    entries.push({ label: 'Preparation', value: sentenceCase(context.fastingStatus) });
  if (context.specimen) entries.push({ label: 'Specimen', value: context.specimen });
  if (context.sampleTiming) entries.push({ label: 'Sample timing', value: context.sampleTiming });
  if (context.population) entries.push({ label: 'Population', value: context.population });
  if (context.method) entries.push({ label: 'Method', value: context.method });
  return entries;
}

export function safePublicSourceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
