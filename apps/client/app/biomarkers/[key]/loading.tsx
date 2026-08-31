import { SiteShell } from '../../../src/site-shell';

export default function BiomarkerLoading() {
  return (
    <SiteShell>
      <div id="main-content" className="skeleton" role="status" aria-live="polite">
        Loading biomarker details…
      </div>
    </SiteShell>
  );
}
