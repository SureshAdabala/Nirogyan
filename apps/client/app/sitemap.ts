import type { MetadataRoute } from 'next';

import { publicBiomarkers, publicCalculator, publicCalculators } from '../src/api';
import { contentIsIndexable, siteOrigin } from '../src/seo';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteOrigin();
  const core: MetadataRoute.Sitemap = [
    { url: new URL('/', origin).toString(), changeFrequency: 'weekly', priority: 1 },
    {
      url: new URL('/biomarkers', origin).toString(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];
  const [summaries, biomarkers] = await Promise.all([
    publicCalculators({ next: { revalidate: 300 } }).catch(() => []),
    publicBiomarkers({}, { next: { revalidate: 300 } }).catch(() => []),
  ]);
  const configs = await Promise.all(
    summaries.map((item) =>
      publicCalculator(item.calculatorSlug, { next: { revalidate: 300 } }).catch(() => undefined),
    ),
  );
  const latestBiomarkers = [...biomarkers]
    .sort((left, right) => right.revision - left.revision)
    .filter(
      (item, index, records) =>
        records.findIndex((candidate) => candidate.key === item.key) === index,
    );
  return [
    ...core,
    ...latestBiomarkers.map((item) => ({
      url: new URL(`/biomarkers/${encodeURIComponent(item.key)}`, origin).toString(),
      changeFrequency: 'monthly' as const,
      priority: 0.65,
    })),
    ...configs
      .filter((config): config is NonNullable<typeof config> =>
        Boolean(config && contentIsIndexable(config)),
      )
      .map((config) => ({
        url: new URL(`/c/${encodeURIComponent(config.calculatorSlug)}`, origin).toString(),
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
  ];
}
