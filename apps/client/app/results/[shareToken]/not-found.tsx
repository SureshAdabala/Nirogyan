import Link from 'next/link';

import { SiteShell } from '../../../src/site-shell';

export default function ResultNotFound() {
  return (
    <SiteShell>
      <section className="empty-state" id="main-content" tabIndex={-1}>
        <p className="eyebrow">Private result unavailable</p>
        <h1>This result link has expired or was revoked.</h1>
        <p>No result details are available from this link.</p>
        <Link className="button" href="/">
          Browse calculators
        </Link>
      </section>
    </SiteShell>
  );
}
