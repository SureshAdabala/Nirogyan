import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('continuous integration wiring', () => {
  it('enforces the canonical lint, unit, integration, build, and E2E dependency chain', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toMatch(/unit:[\s\S]*?needs: lint/u);
    expect(workflow).toMatch(/atlas-integrations:[\s\S]*?needs: unit/u);
    expect(workflow).toMatch(/production-build:[\s\S]*?needs: atlas-integrations/u);
    expect(workflow).toMatch(/p10-live-browser-gate:[\s\S]*?needs: production-build/u);
  });

  it('fails closed without the protected Atlas secret and retains owned-write guards', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow).toContain(
      "ATLAS_INTEGRATIONS_CONFIGURED: ${{ secrets.P10_MONGODB_URI != '' }}",
    );
    expect(workflow).toMatch(/ATLAS_INTEGRATIONS_CONFIGURED[\s\S]*?exit 1/u);
    expect(workflow).toContain('MONGODB_DB_NAME: niro_ci_integration');
    expect(workflow).toContain('npm run db:integration -- --allow-temporary-database-write');
    expect(workflow).toContain('npm run public:integration -- --allow-temporary-database-write');
    expect(workflow).toContain('npm run admin:integration -- --allow-temporary-database-write');
    expect(workflow).toContain('npm run p6:integration -- --allow-temporary-database-write');
    expect(workflow).toContain('npm run analytics:integration -- --allow-temporary-database-write');
    expect(workflow).toContain("if: env.P10_ATLAS_CONFIGURED != 'true'");
    expect(workflow).toMatch(/P10_ATLAS_CONFIGURED[\s\S]*?exit 1/u);
  });

  it('configures weekly npm and GitHub Actions dependency updates', () => {
    const dependabot = read('.github/dependabot.yml');

    expect(dependabot).toContain('version: 2');
    expect(dependabot).toContain('package-ecosystem: npm');
    expect(dependabot).toContain('package-ecosystem: github-actions');
    expect(dependabot.match(/interval: weekly/gu)).toHaveLength(2);
    expect(dependabot.match(/directory: \//gu)).toHaveLength(2);
  });

  it('uses the selected Node 24 native runtime in every CI job', () => {
    const workflow = read('.github/workflows/ci.yml');

    expect(workflow.match(/node-version: 24/gu)).toHaveLength(5);
    expect(workflow).not.toMatch(/node-version: 22/u);
    expect(workflow).toMatch(
      /production-build:[\s\S]*?npm run build[\s\S]*?npm run deploy:native:verify/u,
    );
  });
});
