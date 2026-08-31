import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Vercel frontend deployment contract', () => {
  it('builds the Next app from the workspace root without a container runtime', () => {
    const config = JSON.parse(readFileSync('apps/client/vercel.json', 'utf8')) as {
      framework: string;
      git: { deploymentEnabled: boolean };
      installCommand: string;
      buildCommand: string;
      outputDirectory: string;
    };

    expect(config.framework).toBe('nextjs');
    expect(config.git.deploymentEnabled).toBe(false);
    expect(config.installCommand).toContain('npm ci --include=dev');
    expect(config.installCommand).toContain('npm@11.6.1');
    expect(config.buildCommand).toContain('npm run deploy:build:client-native');
    expect(config.outputDirectory).toBe('.next');
    expect(JSON.stringify(config)).not.toMatch(/docker|container|image/iu);
  });
});
