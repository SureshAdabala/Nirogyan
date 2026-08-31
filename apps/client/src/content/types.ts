import type { ReactNode } from 'react';

export type ContentClaimKind =
  | 'medical-fact'
  | 'threshold'
  | 'formula'
  | 'recommendation'
  | 'product-description'
  | 'disclaimer'
  | 'nonmedical';

export interface ContentClaim {
  readonly id: string;
  readonly text: string;
  readonly kind: ContentClaimKind;
  readonly citationIds: readonly string[];
  readonly reviewStatus: 'unreviewed' | 'verified' | 'disputed' | 'expired' | 'not-applicable';
  readonly reviewNote?: string;
}

export interface ContentCitation {
  readonly id: string;
  readonly type: 'niro' | 'guideline' | 'government' | 'journal' | 'reference' | 'internal';
  readonly org?: string;
  readonly authors?: readonly string[];
  readonly title: string;
  readonly url?: string;
  readonly localRef?: string;
  readonly identifier?: string;
  readonly publishedAt?: string;
  readonly accessedAt?: string;
  readonly verificationStatus:
    | 'fetch-verified'
    | 'source-provided'
    | 'search-verified'
    | 'blocked-cited'
    | 'needs-verification';
  readonly licenseStatus:
    'clear' | 'permission-required' | 'licensed' | 'unknown' | 'not-applicable';
  readonly primarySource?: boolean;
  readonly note?: string;
}

interface ContentBlockBase {
  readonly id: string;
  readonly claimIds?: readonly string[];
}

export interface MarkdownContentBlock extends ContentBlockBase {
  readonly type: 'markdown';
  readonly markdown: string;
}

export interface CalloutContentBlock extends ContentBlockBase {
  readonly type: 'callout';
  readonly tone: 'information' | 'caution' | 'warning' | 'success';
  readonly title?: string;
  readonly markdown: string;
}

export interface FaqContentItem {
  readonly id: string;
  readonly question: string;
  readonly answerMarkdown: string;
  readonly claimIds?: readonly string[];
}

export interface FaqContentBlock extends ContentBlockBase {
  readonly type: 'faq';
  readonly items: readonly FaqContentItem[];
}

export interface StepsContentItem {
  readonly title: string;
  readonly markdown: string;
  readonly claimIds?: readonly string[];
}

export interface StepsContentBlock extends ContentBlockBase {
  readonly type: 'steps';
  readonly steps: readonly StepsContentItem[];
}

export interface TableContentBlock extends ContentBlockBase {
  readonly type: 'table';
  readonly caption: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface MediaContentBlock extends ContentBlockBase {
  readonly type: 'media';
  readonly assetId: string;
  readonly alt: string;
  readonly caption?: string;
}

export interface RelatedContentBlock extends ContentBlockBase {
  readonly type: 'related';
  readonly calculatorSlugs?: readonly string[];
  readonly measurementKeys?: readonly string[];
  readonly contentSlugs?: readonly string[];
}

export interface DisclaimerContentBlock extends ContentBlockBase {
  readonly type: 'disclaimer';
  readonly markdown: string;
}

export interface CalculatorEmbedContentBlock extends ContentBlockBase {
  readonly type: 'calculator-embed';
  readonly calculatorSlug: string;
}

export interface CrisisResource {
  readonly region: string;
  readonly label: string;
  readonly contact: string;
  readonly url?: string;
}

export interface CrisisResourcesContentBlock extends ContentBlockBase {
  readonly type: 'crisis-resources';
  readonly triggerRef: string;
  readonly markdown: string;
  readonly resources: readonly CrisisResource[];
}

export type ContentBlock =
  | MarkdownContentBlock
  | CalloutContentBlock
  | FaqContentBlock
  | StepsContentBlock
  | TableContentBlock
  | MediaContentBlock
  | RelatedContentBlock
  | DisclaimerContentBlock
  | CalculatorEmbedContentBlock
  | CrisisResourcesContentBlock;

export interface ContentPagePresentation {
  readonly contentId: string;
  readonly version: number;
  readonly locale: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly blocks: readonly ContentBlock[];
  readonly claims: readonly ContentClaim[];
  readonly citations: readonly ContentCitation[];
}

export type RelatedContentKind = 'calculator' | 'measurement' | 'content';

export interface ContentRendererProps {
  readonly content: ContentPagePresentation;
  readonly renderTitle?: boolean;
  /**
   * Allows a route-owned page header to render the immutable content summary
   * without repeating it inside this renderer. Defaults to true.
   */
  readonly renderSummary?: boolean;
  readonly visibleBlockIds?: ReadonlySet<string>;
  readonly resolveAsset?: (assetId: string) => string | undefined;
  readonly renderCalculatorEmbed?: (calculatorSlug: string) => ReactNode;
  readonly relatedHref?: (kind: RelatedContentKind, key: string) => string | undefined;
}

export interface BreadcrumbJsonLdItem {
  readonly name: string;
  readonly path: string;
}
