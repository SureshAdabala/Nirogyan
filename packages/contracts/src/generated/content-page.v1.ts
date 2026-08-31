/** Generated from content-page.v1.schema.json; edit the canonical JSON Schema instead. */

export type Slug = string;
export type ContentBlock =
  | MarkdownBlock
  | CalloutBlock
  | FaqBlock
  | StepsBlock
  | TableBlock
  | MediaBlock
  | RelatedBlock
  | DisclaimerBlock
  | CalculatorEmbedBlock
  | CrisisBlock;
export type MarkdownBlock = BlockBase & {
  id: Key;
  type: 'markdown';
  markdown: string;
  claimIds?: Key[];
};
export type Key = string;
export type RelatedBlock = RelatedBlock1 & {
  id: Key;
  type: 'related';
  calculatorSlugs?: Slug[];
  measurementKeys?: Slug[];
  contentSlugs?: Slug[];
  claimIds?: Key[];
};
export type RelatedBlock1 =
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    }
  | {
      [k: string]: unknown;
    };
export type Citation = Citation1 & {
  id: Key;
  type: 'niro' | 'guideline' | 'government' | 'journal' | 'reference' | 'internal';
  org?: string;
  authors?: string[];
  title: string;
  url?: string;
  localRef?: string;
  identifier?: string;
  publishedAt?: string;
  accessedAt?: string;
  verificationStatus:
    | 'fetch-verified'
    | 'source-provided'
    | 'search-verified'
    | 'blocked-cited'
    | 'needs-verification';
  licenseStatus: 'clear' | 'permission-required' | 'licensed' | 'unknown' | 'not-applicable';
  primarySource?: boolean;
  reviewExpiresAt?: string;
  note?: string;
};
export type Citation1 = {
  [k: string]: unknown;
};

/**
 * Structured calculator-associated page content with claim-level evidence, authorship, SEO, lifecycle, and medical review.
 */
export interface NiroCalculatorContentPageV1 {
  schemaVersion: 'content-page.v1';
  contentId: Slug;
  version: number;
  locale: string;
  slug: Slug;
  title: string;
  summary: string;
  /**
   * @minItems 1
   */
  blocks: [ContentBlock, ...ContentBlock[]];
  claims: Claim[];
  citations: Citation[];
  authorship: Authorship;
  medicalReview: MedicalReview;
  seo: Seo;
  publication: Publication;
  related?: Related;
}
export interface BlockBase {
  id: Key;
  type: string;
  claimIds?: Key[];
  [k: string]: unknown;
}
export interface CalloutBlock {
  id: Key;
  type: 'callout';
  tone: 'information' | 'caution' | 'warning' | 'success';
  title?: string;
  markdown: string;
  claimIds?: Key[];
}
export interface FaqBlock {
  id: Key;
  type: 'faq';
  /**
   * @minItems 1
   */
  items: [FaqItem, ...FaqItem[]];
  claimIds?: Key[];
}
export interface FaqItem {
  id: Key;
  question: string;
  answerMarkdown: string;
  claimIds?: Key[];
}
export interface StepsBlock {
  id: Key;
  type: 'steps';
  /**
   * @minItems 1
   */
  steps: [
    {
      title: string;
      markdown: string;
      claimIds?: Key[];
    },
    ...{
      title: string;
      markdown: string;
      claimIds?: Key[];
    }[],
  ];
  claimIds?: Key[];
}
export interface TableBlock {
  id: Key;
  type: 'table';
  caption: string;
  /**
   * @minItems 1
   */
  headers: [string, ...string[]];
  /**
   * @minItems 1
   */
  rows: [[string, ...string[]], ...[string, ...string[]][]];
  claimIds?: Key[];
}
export interface MediaBlock {
  id: Key;
  type: 'media';
  assetId: string;
  alt: string;
  caption?: string;
  claimIds?: Key[];
}
export interface DisclaimerBlock {
  id: Key;
  type: 'disclaimer';
  markdown: string;
  claimIds?: Key[];
}
export interface CalculatorEmbedBlock {
  id: Key;
  type: 'calculator-embed';
  calculatorSlug: Slug;
  claimIds?: Key[];
}
export interface CrisisBlock {
  id: Key;
  type: 'crisis-resources';
  triggerRef: string;
  markdown: string;
  /**
   * @minItems 1
   */
  resources: [CrisisResource, ...CrisisResource[]];
  claimIds?: Key[];
}
export interface CrisisResource {
  region: string;
  label: string;
  contact: string;
  url?: string;
}
export interface Claim {
  id: Key;
  text: string;
  kind:
    | 'medical-fact'
    | 'threshold'
    | 'formula'
    | 'recommendation'
    | 'product-description'
    | 'disclaimer'
    | 'nonmedical';
  citationIds: Key[];
  reviewStatus: 'unreviewed' | 'verified' | 'disputed' | 'expired' | 'not-applicable';
  reviewNote?: string;
}
export interface Authorship {
  /**
   * @minItems 1
   */
  contributors: [Contributor, ...Contributor[]];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface Contributor {
  id: string;
  displayName: string;
  role: 'author' | 'editor' | 'medical-reviewer' | 'source-reviewer';
  credentials?: string;
  profileSlug?: Slug;
}
export interface MedicalReview {
  status:
    | 'unreviewed'
    | 'in-review'
    | 'approved'
    | 'changes-requested'
    | 'rejected'
    | 'expired'
    | 'not-applicable';
  scope: 'content-only' | 'clinical-claims' | 'full-page' | 'not-applicable';
  reviewerId: string | null;
  reviewedAt: string | null;
  nextReviewAt: string | null;
  decisionNote: string | null;
  approvedClaimIds?: Key[];
}
export interface Seo {
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;
  robots: {
    index: boolean;
    follow: boolean;
  };
  /**
   * @minItems 1
   */
  schemaTypes: [
    'WebPage' | 'MedicalWebPage' | 'FAQPage' | 'SoftwareApplication' | 'BreadcrumbList',
    ...('WebPage' | 'MedicalWebPage' | 'FAQPage' | 'SoftwareApplication' | 'BreadcrumbList')[],
  ];
  openGraph?: {
    title?: string;
    description?: string;
    image?: SocialImage;
  };
  keywords?: string[];
  redirectsFrom?: string[];
}
export interface SocialImage {
  assetId: string;
  alt: string;
}
export interface Publication {
  status: 'draft' | 'in-review' | 'approved' | 'published' | 'retired';
  publishedAt: string | null;
  retiredAt: string | null;
  changelog: string;
  replacementSlug?: Slug;
}
export interface Related {
  calculatorSlugs?: Slug[];
  measurementKeys?: Slug[];
  contentSlugs?: Slug[];
}
