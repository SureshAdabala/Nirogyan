export interface ParsedUserAgent {
  readonly device: 'mobile' | 'tablet' | 'desktop' | 'other';
  readonly browser: string;
  readonly os: string;
  readonly isBot: boolean;
}

function version(match: RegExpMatchArray | null): string {
  const major = match?.[1]?.split(/[._]/)[0];
  return major ? ` ${major}` : '';
}

/**
 * Deliberately bounded server-side classification. Raw user-agent strings are
 * never returned or persisted, and unknown agents stay in coarse buckets.
 */
export function parseUserAgent(raw = ''): ParsedUserAgent {
  const userAgent = raw.slice(0, 1_024);
  const isBot =
    /(bot|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|preview|facebookexternalhit|bingpreview)/i.test(
      userAgent,
    );
  const device: ParsedUserAgent['device'] = /ipad|tablet|kindle|silk/i.test(userAgent)
    ? 'tablet'
    : /mobi|iphone|ipod|android.+mobile/i.test(userAgent)
      ? 'mobile'
      : userAgent
        ? 'desktop'
        : 'other';

  let browser = 'Other';
  let match: RegExpMatchArray | null;
  if ((match = userAgent.match(/Edg\/([\d.]+)/))) browser = `Edge${version(match)}`;
  else if ((match = userAgent.match(/OPR\/([\d.]+)/))) browser = `Opera${version(match)}`;
  else if ((match = userAgent.match(/Firefox\/([\d.]+)/))) browser = `Firefox${version(match)}`;
  else if ((match = userAgent.match(/CriOS\/([\d.]+)/))) browser = `Chrome${version(match)}`;
  else if ((match = userAgent.match(/Chrome\/([\d.]+)/))) browser = `Chrome${version(match)}`;
  else if ((match = userAgent.match(/Version\/([\d.]+).+Safari/)))
    browser = `Safari${version(match)}`;

  let os = 'Other';
  if ((match = userAgent.match(/Windows NT ([\d.]+)/))) os = `Windows${version(match)}`;
  else if ((match = userAgent.match(/Android ([\d.]+)/))) os = `Android${version(match)}`;
  else if ((match = userAgent.match(/(?:iPhone OS|CPU OS) ([\d_]+)/))) os = `iOS${version(match)}`;
  else if ((match = userAgent.match(/Mac OS X ([\d_]+)/))) os = `macOS${version(match)}`;
  else if (/Linux/i.test(userAgent)) os = 'Linux';

  return { device, browser, os, isBot };
}

export function primaryLocale(acceptLanguage: string | undefined): string {
  const locale = acceptLanguage?.split(',')[0]?.trim().slice(0, 35);
  return locale && /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/.test(locale) ? locale : 'unknown';
}
