import type { PublicCalculatorConfig } from '@niro/contracts';
import type { Metadata } from 'next';

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function siteOrigin(): URL {
  const configured = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const candidate = configured ?? 'http://localhost:3000';
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return new URL('http://localhost:3000');
  }
  if (!['http:', 'https:'].includes(url.protocol)) return new URL('http://localhost:3000');
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

export function publicTestApiConfigured(): boolean {
  const configured = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) return false;
  try {
    const url = new URL(configured);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      url.pathname.replace(/\/+$/, '').endsWith('/public-test')
    );
  } catch {
    return false;
  }
}

export function canonicalPath(value: unknown, fallback: string): string {
  const path = text(value);
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback;
  try {
    const url = new URL(path, siteOrigin());
    if (url.origin !== siteOrigin().origin) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function calculatorMetadata(config: PublicCalculatorConfig): Metadata {
  const content = record(config.content);
  const seo = record(content.seo);
  const robots = record(seo.robots);
  const openGraph = record(seo.openGraph);
  const fallbackPath = `/c/${encodeURIComponent(config.calculatorSlug)}`;
  const title = text(seo.metaTitle) ?? config.name ?? config.calculatorSlug;
  const description =
    text(seo.metaDescription) ?? config.shortDescription ?? 'Educational health calculator.';
  const canonical = canonicalPath(seo.canonicalPath, fallbackPath);
  const testingRecord = config.releaseState === 'testing-unapproved';
  const index = testingRecord ? false : robots.index === undefined ? true : robots.index === true;
  const follow = testingRecord
    ? false
    : robots.follow === undefined
      ? true
      : robots.follow === true;
  const keywords = Array.isArray(seo.keywords)
    ? seo.keywords.filter((item): item is string => typeof item === 'string')
    : undefined;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index, follow },
    keywords,
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      url: canonical,
      title: text(openGraph.title) ?? title,
      description: text(openGraph.description) ?? description,
      siteName: 'Niro Health Calculators',
    },
  };
}

export function contentIsIndexable(config: PublicCalculatorConfig): boolean {
  if (config.releaseState === 'testing-unapproved') return false;
  const seo = record(record(config.content).seo);
  const robots = record(seo.robots);
  return robots.index !== false;
}
