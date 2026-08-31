// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ContentRenderer } from './ContentRenderer';
import { breadcrumbJsonLd, faqJsonLd, JsonLdScript, jsonLdStringify } from './jsonLd';
import { safeContentUrl } from './SafeMarkdown';
import type { ContentPagePresentation } from './types';

const content: ContentPagePresentation = {
  contentId: 'synthetic-content',
  version: 1,
  locale: 'en-IN',
  slug: 'synthetic-content',
  title: 'Synthetic educational calculator',
  summary: 'Reviewed synthetic copy used only to test the generic content renderer.',
  claims: [
    {
      id: 'claim-reviewed',
      text: 'This is a reviewed synthetic claim.',
      kind: 'medical-fact',
      citationIds: ['citation-reviewed'],
      reviewStatus: 'verified',
    },
    {
      id: 'claim-unreviewed',
      text: 'This claim is intentionally unreviewed.',
      kind: 'medical-fact',
      citationIds: ['citation-reviewed'],
      reviewStatus: 'unreviewed',
    },
  ],
  citations: [
    {
      id: 'citation-reviewed',
      type: 'government',
      org: 'Example Health Authority',
      title: 'Synthetic evidence record',
      url: 'https://example.test/evidence',
      accessedAt: '2026-08-23',
      verificationStatus: 'fetch-verified',
      licenseStatus: 'clear',
    },
  ],
  blocks: [
    {
      id: 'intro',
      type: 'markdown',
      markdown:
        '# Authored heading\n\nVisible **Markdown**. <script>alert("unsafe")</script> [unsafe](javascript:alert(1))',
      claimIds: ['claim-reviewed'],
    },
    {
      id: 'callout',
      type: 'callout',
      tone: 'information',
      title: 'Before you start',
      markdown: 'Use your most recent information.',
    },
    {
      id: 'faq',
      type: 'faq',
      items: [
        {
          id: 'faq-reviewed',
          question: 'What does this test?',
          answerMarkdown: 'It tests the **generic renderer**.',
          claimIds: ['claim-reviewed'],
        },
        {
          id: 'faq-unreviewed',
          question: 'Is this unreviewed?',
          answerMarkdown: 'This answer is not eligible for FAQ structured data.',
          claimIds: ['claim-unreviewed'],
        },
      ],
    },
    {
      id: 'steps',
      type: 'steps',
      steps: [{ title: 'Enter information', markdown: 'Use the labelled fields.' }],
    },
    {
      id: 'table',
      type: 'table',
      caption: 'Synthetic comparison',
      headers: ['Item', 'Meaning'],
      rows: [['A', 'Example']],
    },
    {
      id: 'media',
      type: 'media',
      assetId: 'managed-image-one',
      alt: 'A synthetic health illustration',
      caption: 'Managed media caption',
    },
    {
      id: 'related',
      type: 'related',
      calculatorSlugs: ['another-calculator'],
      measurementKeys: ['hdl-cholesterol'],
      contentSlugs: ['another-article'],
    },
    {
      id: 'disclaimer',
      type: 'disclaimer',
      markdown: 'Educational information only.',
      claimIds: ['claim-reviewed'],
    },
    {
      id: 'embed',
      type: 'calculator-embed',
      calculatorSlug: 'synthetic-assessment',
    },
    {
      id: 'crisis',
      type: 'crisis-resources',
      triggerRef: 'reviewed-trigger',
      markdown: 'Seek immediate help when needed.',
      resources: [
        {
          region: 'Test region',
          label: 'Emergency resource',
          contact: 'Call local emergency services',
          url: 'https://example.test/help',
        },
      ],
    },
  ],
};

afterEach(cleanup);

describe('ContentRenderer', () => {
  it('renders every P0A block safely and accessibly without a duplicate authored H1', async () => {
    const { container } = render(
      <ContentRenderer
        content={content}
        resolveAsset={(assetId) =>
          assetId === 'managed-image-one' ? '/managed/media/synthetic.png' : undefined
        }
        renderCalculatorEmbed={(slug) => <div data-testid="calculator-embed">Embed {slug}</div>}
      />,
    );

    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(content.title);
    expect(screen.getByRole('heading', { level: 2, name: 'Authored heading' })).toBeInTheDocument();
    expect(container.querySelector('script')).not.toBeInTheDocument();
    expect(screen.queryByText('alert("unsafe")')).not.toBeInTheDocument();
    expect(screen.getByText('unsafe').closest('a')).toBeNull();

    expect(screen.getByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    expect(screen.getByText('What does this test?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Steps' })).toBeInTheDocument();
    expect(screen.getByText('Synthetic comparison')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Item' })).toHaveAttribute('scope', 'col');
    expect(screen.getByRole('img', { name: 'A synthetic health illustration' })).toHaveAttribute(
      'src',
      '/managed/media/synthetic.png',
    );
    expect(screen.getByRole('link', { name: 'Another calculator' })).toHaveAttribute(
      'href',
      '/c/another-calculator',
    );
    expect(screen.getByLabelText('Educational disclaimer')).toHaveTextContent(
      'Educational information only',
    );
    expect(screen.getByTestId('calculator-embed')).toHaveTextContent('synthetic-assessment');
    expect(screen.getByRole('heading', { name: 'Urgent support' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Emergency resource' })).toHaveAttribute(
      'href',
      'https://example.test/help',
    );
    expect(screen.getAllByText('Synthetic evidence record').length).toBeGreaterThan(0);
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });

  it('renders a managed-media fallback without fabricating an asset URL', () => {
    render(
      <ContentRenderer
        content={{ ...content, blocks: [content.blocks.find((block) => block.id === 'media')!] }}
      />,
    );
    expect(screen.getByRole('img', { name: 'A synthetic health illustration' })).toHaveTextContent(
      'Managed media unavailable',
    );
    expect(document.querySelector('img')).toBeNull();
  });

  it('lets a route-owned header suppress its duplicate title and summary without hiding blocks', () => {
    const disclaimer = content.blocks.find((block) => block.type === 'disclaimer')!;
    const { container } = render(
      <ContentRenderer
        content={{ ...content, blocks: [disclaimer] }}
        renderTitle={false}
        renderSummary={false}
      />,
    );

    expect(container.querySelector('header')).not.toBeInTheDocument();
    expect(screen.queryByText(content.title)).not.toBeInTheDocument();
    expect(screen.queryByText(content.summary)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Educational disclaimer')).toHaveLength(1);
    expect(screen.getByText('Educational information only.')).toBeInTheDocument();
  });

  it('filters FAQ JSON-LD to visible items whose linked claims are reviewed', () => {
    const value = faqJsonLd(content, new Set(['faq']));
    const serialized = JSON.stringify(value);
    expect(serialized).toContain('What does this test?');
    expect(serialized).toContain('It tests the generic renderer.');
    expect(serialized).not.toContain('Is this unreviewed?');
    expect(faqJsonLd(content, new Set(['intro']))).toBeUndefined();
  });

  it('builds route-derived breadcrumbs and safely serializes JSON-LD', () => {
    const value = breadcrumbJsonLd(
      [
        { name: 'Home', path: '/' },
        { name: 'Calculator </script><script>unsafe()</script>', path: '/c/synthetic-assessment' },
        { name: 'Invalid', path: 'javascript:alert(1)' },
      ],
      'https://health.example.test',
    );
    expect(value).toMatchObject({ '@type': 'BreadcrumbList' });
    const serialized = jsonLdStringify(value);
    expect(serialized).not.toContain('<');
    expect(serialized).toContain('\\u003c/script>');

    const { container } = render(<JsonLdScript value={value} id="breadcrumbs-jsonld" />);
    const script = container.querySelector('script');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    expect(script?.textContent).not.toContain('<script>');
  });

  it('allows only controlled link protocols', () => {
    expect(safeContentUrl('/c/example')).toBe('/c/example');
    expect(safeContentUrl('https://example.test')).toBe('https://example.test');
    expect(safeContentUrl('mailto:care@example.test')).toBe('mailto:care@example.test');
    expect(safeContentUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeContentUrl('//untrusted.example.test')).toBeUndefined();
  });
});
