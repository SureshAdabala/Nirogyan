import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface LinkCheckOptions {
  readonly baseUrl: string;
  readonly maxPages?: number;
  readonly checkExternal?: boolean;
  readonly requestTimeoutMs?: number;
  readonly publicOnly?: boolean;
}

export interface CheckedLink {
  readonly url: string;
  readonly status: number;
  readonly source: string;
  readonly external: boolean;
}

export interface LinkCheckResult {
  readonly status: 'ok';
  readonly pagesVisited: number;
  readonly linksChecked: number;
  readonly links: readonly CheckedLink[];
}

const HREF_PATTERN = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/giu;

export function extractHtmlLinks(html: string): readonly string[] {
  const links: string[] = [];
  for (const match of html.matchAll(HREF_PATTERN)) {
    const value = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (value && !links.includes(value)) links.push(value);
  }
  return links;
}

function normalizedPageUrl(url: URL): string {
  url.hash = '';
  return url.toString();
}

function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [first = 0, second = 0, third = 0] = address.split('.').map((part) => Number(part));
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0 && third === 0) ||
      (first === 192 && second === 0 && third === 2) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113) ||
      first >= 224
    );
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized.startsWith('::ffff:')) {
      return isPublicAddress(normalized.slice('::ffff:'.length));
    }
    return (
      /^[23]/u.test(normalized) &&
      !normalized.startsWith('2001:db8:') &&
      normalized !== '2001:db8::'
    );
  }
  return false;
}

export function assertPublicLinkCheckUrl(url: URL): void {
  if (url.protocol !== 'https:') {
    throw new Error('Public link checks require HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Public link checks forbid URL credentials.');
  }
  if (url.port && url.port !== '443') {
    throw new Error('Public link checks require the standard HTTPS port.');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    isIP(hostname) !== 0 ||
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Public link checks require a public DNS hostname.');
  }
}

async function assertPublicResolution(url: URL): Promise<void> {
  assertPublicLinkCheckUrl(url);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new Error(`${url.hostname} did not resolve exclusively to public addresses.`);
  }
}

async function fetched(
  url: string,
  timeoutMs: number,
  publicOnly: boolean,
  validatedHosts: Map<string, Promise<void>>,
): Promise<{
  readonly status: number;
  readonly contentType: string;
  readonly text: string;
  readonly finalUrl: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let target = new URL(url);
    let response: Response | undefined;
    for (let redirectCount = 0; redirectCount <= 10; redirectCount += 1) {
      if (publicOnly) {
        const hostKey = `${target.protocol}//${target.host}`;
        let validation = validatedHosts.get(hostKey);
        if (!validation) {
          validation = assertPublicResolution(target);
          validatedHosts.set(hostKey, validation);
        }
        await validation;
      }
      response = await fetch(target, {
        redirect: publicOnly ? 'manual' : 'follow',
        headers: { 'user-agent': 'Niro-P10-Link-Checker/1.0' },
        signal: controller.signal,
      });
      if (!publicOnly || response.status < 300 || response.status >= 400) break;
      const location = response.headers.get('location');
      if (!location) break;
      await response.body?.cancel();
      target = new URL(location, target);
      response = undefined;
    }
    if (!response) throw new Error('Link exceeded the maximum of 10 redirects.');
    const contentType = response.headers.get('content-type') ?? '';
    return {
      status: response.status,
      contentType,
      text: contentType.includes('text/html') ? await response.text() : '',
      finalUrl: response.url || target.toString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkSiteLinks(options: LinkCheckOptions): Promise<LinkCheckResult> {
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) {
    throw new Error('Link-check base URL must use HTTP or HTTPS.');
  }
  if (options.publicOnly) {
    assertPublicLinkCheckUrl(base);
    if (base.search || base.hash) {
      throw new Error('Public link-check base URL must not contain a query or fragment.');
    }
  }
  const maxPages = options.maxPages ?? 100;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 1000) {
    throw new Error('maxPages must be an integer from 1 through 1000.');
  }
  const timeoutMs = options.requestTimeoutMs ?? 10_000;
  const queue: { readonly url: string; readonly source: string }[] = [
    { url: normalizedPageUrl(base), source: '[entry]' },
  ];
  const requested = new Set<string>();
  const links: CheckedLink[] = [];
  const errors: string[] = [];
  const validatedHosts = new Map<string, Promise<void>>();

  while (queue.length > 0 && requested.size < maxPages) {
    const item = queue.shift();
    if (!item || requested.has(item.url)) continue;
    requested.add(item.url);
    let response: Awaited<ReturnType<typeof fetched>>;
    try {
      response = await fetched(item.url, timeoutMs, options.publicOnly === true, validatedHosts);
    } catch (error) {
      errors.push(`${item.url} (${error instanceof Error ? error.message : 'request failed'})`);
      continue;
    }
    const current = new URL(response.finalUrl);
    const external = current.origin !== base.origin;
    links.push({ url: item.url, status: response.status, source: item.source, external });
    if (response.status < 200 || response.status >= 400) {
      errors.push(`${item.url} returned ${response.status} (linked from ${item.source})`);
      continue;
    }
    if (external || !response.contentType.includes('text/html')) continue;
    for (const href of extractHtmlLinks(response.text)) {
      if (/^(?:mailto:|tel:|#)/iu.test(href)) continue;
      if (/^(?:javascript:|data:|vbscript:)/iu.test(href)) {
        errors.push(`${item.url} contains an unsafe link protocol: ${href.slice(0, 40)}`);
        continue;
      }
      let target: URL;
      try {
        target = new URL(href, current);
      } catch {
        errors.push(`${item.url} contains a malformed link: ${href}`);
        continue;
      }
      const isExternal = target.origin !== base.origin;
      if (isExternal && !options.checkExternal) continue;
      if (!['http:', 'https:'].includes(target.protocol)) {
        errors.push(`${item.url} contains unsupported link protocol ${target.protocol}`);
        continue;
      }
      const normalized = normalizedPageUrl(target);
      if (!requested.has(normalized) && !queue.some((queued) => queued.url === normalized)) {
        queue.push({ url: normalized, source: item.url });
      }
    }
  }
  if (queue.length > 0) errors.push(`crawl exceeded maxPages=${maxPages}`);
  if (errors.length > 0) throw new Error(`P10 link check failed:\n${errors.join('\n')}`);
  return { status: 'ok', pagesVisited: requested.size, linksChecked: links.length, links };
}

async function main(): Promise<void> {
  const arguments_ = process.argv.slice(2);
  const publicOnly = arguments_.includes('--public-only');
  const argumentUrl = arguments_.find((item) => !item.startsWith('--'));
  const baseUrl = argumentUrl ?? (publicOnly ? undefined : process.env.P10_CLIENT_URL);
  if (!baseUrl) throw new Error('Provide the site base URL or P10_CLIENT_URL.');
  console.log(
    JSON.stringify(
      await checkSiteLinks({
        baseUrl,
        checkExternal: arguments_.includes('--external'),
        maxPages: Number(process.env.P10_LINK_CHECK_MAX_PAGES ?? 100),
        publicOnly,
      }),
    ),
  );
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
