import type { PublicCalculatorConfig } from '@niro/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { contentPresentation } from './content-adapter';
import {
  calculatorMetadata,
  canonicalPath,
  contentIsIndexable,
  publicTestApiConfigured,
  siteOrigin,
} from './seo';

const config: PublicCalculatorConfig = {
  slug: 'synthetic-calculator',
  calculatorSlug: 'synthetic-calculator',
  version: 1,
  name: 'Synthetic calculator',
  shortDescription: 'Nonclinical SEO fixture.',
  disclaimers: ['Testing only.'],
  parameters: [],
  uiConfig: {
    steps: [],
    result: { layout: ['category'] },
  },
  content: {
    contentId: 'synthetic-content',
    version: 1,
    locale: 'en-IN',
    slug: 'synthetic-calculator',
    title: 'Synthetic content',
    summary: 'Reviewed synthetic summary.',
    blocks: [],
    claims: [],
    citations: [],
    seo: {
      metaTitle: 'Reviewed synthetic title',
      metaDescription: 'Reviewed synthetic description.',
      canonicalPath: '/c/synthetic-calculator',
      robots: { index: true, follow: true },
      keywords: ['synthetic'],
      openGraph: { title: 'Synthetic social title' },
    },
  },
};

afterEach(() => vi.unstubAllEnvs());

describe('public SEO boundary', () => {
  it('uses an environment-owned same-origin canonical URL and reviewed metadata', () => {
    vi.stubEnv('SITE_URL', 'https://health.example.test/base');
    expect(siteOrigin().toString()).toBe('https://health.example.test/');
    expect(calculatorMetadata(config)).toMatchObject({
      title: 'Reviewed synthetic title',
      description: 'Reviewed synthetic description.',
      alternates: { canonical: '/c/synthetic-calculator' },
      robots: { index: true, follow: true },
      openGraph: { title: 'Synthetic social title' },
    });
    expect(contentIsIndexable(config)).toBe(true);
  });

  it('rejects protocol-relative/external canonical values', () => {
    vi.stubEnv('SITE_URL', 'https://health.example.test');
    expect(canonicalPath('//evil.example/path', '/c/fallback')).toBe('/c/fallback');
    expect(canonicalPath('https://evil.example/path', '/c/fallback')).toBe('/c/fallback');
    expect(canonicalPath('/safe?version=1', '/c/fallback')).toBe('/safe?version=1');
  });

  it('keeps testing/unapproved calculator records out of search indexing', () => {
    const testingConfig = { ...config, releaseState: 'testing-unapproved' as const };
    expect(calculatorMetadata(testingConfig)).toMatchObject({
      robots: { index: false, follow: false },
    });
    expect(contentIsIndexable(testingConfig)).toBe(false);
  });

  it('identifies only the explicit public-test API for global noindex metadata', () => {
    vi.stubEnv('API_BASE_URL', 'http://localhost:4000/api/v1/public-test/');
    expect(publicTestApiConfigured()).toBe(true);

    vi.stubEnv('API_BASE_URL', 'https://api.example.test/api/v1');
    expect(publicTestApiConfigured()).toBe(false);

    vi.stubEnv('API_BASE_URL', 'not-an-absolute-url');
    expect(publicTestApiConfigured()).toBe(false);
  });

  it('refuses incomplete content before it reaches the typed renderer', () => {
    expect(contentPresentation(undefined)).toBeUndefined();
    expect(contentPresentation({ blocks: [] })).toBeUndefined();
    expect(contentPresentation(config.content)).toMatchObject({
      contentId: 'synthetic-content',
      locale: 'en-IN',
    });
  });
});
