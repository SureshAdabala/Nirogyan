import React from 'react';

import type { BreadcrumbJsonLdItem, ContentPagePresentation, FaqContentItem } from './types';

function plainText(markdown: string): string {
  return markdown
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function faqItemIsReviewed(
  content: ContentPagePresentation,
  item: FaqContentItem,
  blockClaimIds: readonly string[] = [],
): boolean {
  const claimIds = [...new Set([...blockClaimIds, ...(item.claimIds ?? [])])];
  if (!claimIds.length) return true;
  return claimIds.every((claimId) => {
    const claim = content.claims.find((candidate) => candidate.id === claimId);
    return claim?.reviewStatus === 'verified' || claim?.reviewStatus === 'not-applicable';
  });
}

export function faqJsonLd(
  content: ContentPagePresentation,
  visibleBlockIds?: ReadonlySet<string>,
): Record<string, unknown> | undefined {
  const mainEntity = content.blocks
    .filter((block) => block.type === 'faq' && (!visibleBlockIds || visibleBlockIds.has(block.id)))
    .flatMap((block) =>
      block.type === 'faq'
        ? block.items
            .filter((item) => faqItemIsReviewed(content, item, block.claimIds))
            .map((item) => ({
              '@type': 'Question',
              name: plainText(item.question),
              acceptedAnswer: {
                '@type': 'Answer',
                text: plainText(item.answerMarkdown),
              },
            }))
        : [],
    )
    .filter((item) => item.name && item.acceptedAnswer.text);
  return mainEntity.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity,
      }
    : undefined;
}

function safeOrigin(origin: string | undefined): string | undefined {
  if (!origin) return undefined;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

function safePath(path: string): string | undefined {
  return path.startsWith('/') && !path.startsWith('//') ? path : undefined;
}

export function breadcrumbJsonLd(
  items: readonly BreadcrumbJsonLdItem[],
  origin?: string,
): Record<string, unknown> | undefined {
  const base = safeOrigin(origin);
  const validItems = items.flatMap((item) => {
    const path = safePath(item.path);
    const name = item.name.trim();
    if (!path || !name) return [];
    return [{ name, path }];
  });
  const itemListElement = validItems.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: base ? new URL(item.path, base).toString() : item.path,
  }));
  return itemListElement.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement,
      }
    : undefined;
}

export function jsonLdStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Isolated JSON-LD boundary. Values must come from the reviewed helpers above. */
export function JsonLdScript({
  value,
  id,
}: {
  readonly value: Record<string, unknown> | undefined;
  readonly id?: string;
}) {
  if (!value) return null;
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdStringify(value) }}
    />
  );
}
