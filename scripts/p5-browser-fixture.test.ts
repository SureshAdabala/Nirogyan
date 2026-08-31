import { validateMeasurementDefinitionStructure } from '@niro/contracts';
import { describe, expect, it } from 'vitest';

import {
  assertSafeP5FixtureEnvironment,
  createP5MeasurementDefinition,
  createP5MeasurementEnvelope,
  fixturePayload,
  P5_FIXTURE_ID,
  p5FixtureIdentity,
  p5FixtureOwnershipIssue,
  type P5FixtureFootprint,
} from './p5-browser-fixture';

const SLUG = 'p5-ui-local-demo';

function ownedFootprint(): P5FixtureFootprint {
  const identity = p5FixtureIdentity(SLUG);
  const envelope = createP5MeasurementEnvelope(SLUG);
  return {
    calculators: [
      {
        _id: identity.calculatorId,
        slug: SLUG,
        name: 'Synthetic wellness demo',
        status: 'published',
        currentVersionId: identity.versionId,
      },
    ],
    versions: [
      {
        _id: identity.versionId,
        calculatorId: identity.calculatorId,
        calculatorSlug: SLUG,
        version: 1,
        status: 'published',
        versionHash: identity.versionHash,
        payload: fixturePayload(SLUG),
        measurementRevisionIds: [identity.measurementId.toString()],
        measurementSnapshots: [
          {
            measurementRevisionId: identity.measurementId.toString(),
            key: envelope.key,
            revision: envelope.revision,
            definitionHash: envelope.definitionHash,
            definition: envelope.definition,
            sources: envelope.sources,
          },
        ],
      },
    ],
    measurements: [envelope],
  };
}

describe('P5 persistent local demo safety', () => {
  it('allows only the explicit local shared development database', () => {
    expect(() =>
      assertSafeP5FixtureEnvironment({
        nodeEnv: 'development',
        mongoDbName: 'niro_dev',
        deploymentEnvironment: undefined,
      }),
    ).not.toThrow();
    expect(() =>
      assertSafeP5FixtureEnvironment({
        nodeEnv: 'production',
        mongoDbName: 'niro_dev',
        deploymentEnvironment: 'production',
      }),
    ).toThrow('only in development');
  });

  it.each(['staging', 'production'] as const)(
    'refuses the %s deployment identity even if NODE_ENV is misconfigured as development',
    (deploymentEnvironment) => {
      expect(() =>
        assertSafeP5FixtureEnvironment({
          nodeEnv: 'development',
          mongoDbName: 'niro_dev',
          deploymentEnvironment,
        }),
      ).toThrow('local-only');
    },
  );

  it.each(['niro_prod', 'niro_production', 'production', 'prod', 'NIRO_DEV'])(
    'refuses the non-development database name %s',
    (mongoDbName) => {
      expect(() =>
        assertSafeP5FixtureEnvironment({
          nodeEnv: 'development',
          mongoDbName,
          deploymentEnvironment: undefined,
        }),
      ).toThrow('only in the niro_dev');
    },
  );

  it('creates one valid, explicitly synthetic, nonclinical public measurement envelope', () => {
    const definition = createP5MeasurementDefinition(SLUG);
    const envelope = createP5MeasurementEnvelope(SLUG);
    expect(validateMeasurementDefinitionStructure(definition).valid).toBe(true);
    expect(definition).toMatchObject({
      key: p5FixtureIdentity(SLUG).measurementKey,
      status: 'approved',
      displayName: 'Synthetic interface marker (nonclinical demo)',
      referenceRanges: [],
      sources: [{ type: 'internal', verification: 'source-provided' }],
    });
    expect(envelope).toMatchObject({
      status: 'verified',
      kind: 'biomarker',
      migrationProvenance: {
        fixture: P5_FIXTURE_ID,
        fixtureSlug: SLUG,
        clinicalUse: false,
      },
    });
  });

  it('binds the calculator parameter and immutable snapshot to that exact revision', () => {
    const identity = p5FixtureIdentity(SLUG);
    const payload = fixturePayload(SLUG);
    expect(payload).toMatchObject({
      parameters: expect.arrayContaining([
        expect.objectContaining({
          key: 'labValue',
          biomarkerKey: identity.measurementKey,
          unit: { canonical: 'ratio', allowed: [{ code: '%', factor: 0.01 }] },
        }),
      ]),
      content: {
        medicalReview: { status: 'not-applicable' },
        seo: { robots: { index: false, follow: false } },
      },
    });
    expect(p5FixtureOwnershipIssue(SLUG, ownedFootprint())).toBeUndefined();
  });

  it('refuses cleanup ownership if provenance is altered or extra records appear', () => {
    const footprint = ownedFootprint();
    expect(
      p5FixtureOwnershipIssue(SLUG, {
        ...footprint,
        measurements: [
          {
            ...footprint.measurements[0],
            migrationProvenance: { fixture: 'foreign' },
          },
        ],
      }),
    ).toContain('not exactly owned');
    expect(
      p5FixtureOwnershipIssue(SLUG, {
        ...footprint,
        calculators: [...footprint.calculators, { slug: SLUG }],
      }),
    ).toContain('cardinality');
  });
});
