import type { Metadata } from 'next';

import { AnalyticsProvider } from '../src/analytics/AnalyticsProvider';
import { QueryProvider } from '../src/query-provider';
import { publicTestApiConfigured, siteOrigin } from '../src/seo';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: {
    default: 'Niro Health Calculators',
    template: '%s | Niro Health Calculators',
  },
  description: 'Educational, evidence-aware health calculators built from reviewed contracts.',
  applicationName: 'Niro Health Calculators',
  referrer: 'strict-origin-when-cross-origin',
  robots: publicTestApiConfigured()
    ? { index: false, follow: false }
    : { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <QueryProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
