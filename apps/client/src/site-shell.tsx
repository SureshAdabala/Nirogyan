import Link from 'next/link';

import { SlideTabs } from '@/components/ui/slide-tabs';

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
        </span>
        <span className="brand-name">NIRO Health</span>
        <span className="brand-partner">Nirgyan</span>
        <span className="brand-product">Calculators</span>
      </Link>
      <div className="site-nav">
        <SlideTabs />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Educational information only — not a diagnosis or substitute for medical care.</p>
      <p>Your laboratory’s reference range and advice from your clinician take precedence.</p>
    </footer>
  );
}

export function SiteShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="site-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}
