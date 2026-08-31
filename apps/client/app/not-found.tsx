import Link from 'next/link';

import { SiteShell } from '../src/site-shell';

export default function NotFound() {
  return (
    <SiteShell>
      <section className="empty-state" id="main-content" tabIndex={-1}>
        <p className="eyebrow">Not found</p>
        <h1>This health calculator is unavailable.</h1>
        <p>It may not exist, may not be published, or may have been retired.</p>
        <Link className="button" href="/">
          Browse published calculators
        </Link>
      </section>
    </SiteShell>
  );
}
