import type { MetadataRoute } from 'next';

import { siteOrigin } from '../src/seo';

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/results/', '/admin/', '/api/'],
    },
    sitemap: new URL('/sitemap.xml', origin).toString(),
    host: origin.origin,
  };
}
