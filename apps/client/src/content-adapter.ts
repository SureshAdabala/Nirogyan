import type { PublicContentPage } from '@niro/contracts';

import type { ContentPagePresentation } from './content';

/**
 * Public content was structurally validated before publication. This boundary
 * still refuses incomplete payloads so a malformed API response cannot crash
 * the page renderer.
 */
export function contentPresentation(
  content: PublicContentPage | undefined,
): ContentPagePresentation | undefined {
  if (
    !content ||
    typeof content.contentId !== 'string' ||
    typeof content.version !== 'number' ||
    typeof content.locale !== 'string' ||
    typeof content.slug !== 'string' ||
    typeof content.title !== 'string' ||
    typeof content.summary !== 'string' ||
    !Array.isArray(content.blocks) ||
    !Array.isArray(content.claims) ||
    !Array.isArray(content.citations)
  )
    return undefined;
  return content as unknown as ContentPagePresentation;
}
