import { describe, expect, it } from 'vitest';

import { loadEnvironment } from './config/env';
import { createServerPersistenceDependencies } from './runtime-persistence';

describe('server persistence startup wiring', () => {
  it('constructs assessment/result persistence whenever Mongo and retention are configured', () => {
    const environment = loadEnvironment({
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://example.test/niro_dev',
      ASSESSMENT_RETENTION_DAYS: '1',
    });

    const dependencies = createServerPersistenceDependencies(environment);

    expect(dependencies.assessmentStore).toBeDefined();
  });

  it('fails at startup instead of serving a Mongo catalog with broken assessments', () => {
    const environment = loadEnvironment({
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://example.test/niro_dev',
    });

    expect(() => createServerPersistenceDependencies(environment)).toThrow(
      /ASSESSMENT_RETENTION_DAYS is required.*refusing to start/u,
    );
  });

  it('keeps the database-free application foundation available for isolated tests', () => {
    const environment = loadEnvironment({ NODE_ENV: 'test' });

    expect(createServerPersistenceDependencies(environment)).toEqual({
      assessmentStore: undefined,
      leadCapture: undefined,
    });
  });

  it('constructs optional lead capture only from the complete validated policy pair', () => {
    const environment = loadEnvironment({
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb://example.test/niro_dev',
      ASSESSMENT_RETENTION_DAYS: '1',
      LEAD_RETENTION_DAYS: '7',
      LEAD_CONSENT_VERSION: 'local-v1',
    });

    expect(createServerPersistenceDependencies(environment).leadCapture).toEqual({
      store: expect.objectContaining({ save: expect.any(Function) }),
      consentVersion: 'local-v1',
    });
  });
});
