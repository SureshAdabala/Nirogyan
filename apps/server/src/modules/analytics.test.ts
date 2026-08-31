import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OperationalMetrics } from '../analytics/metrics';
import {
  createAnalyticsRouter,
  createMongoAnalyticsAttributionStore,
  createMongoAnalyticsEventStore,
  createMongoAnalyticsSearchVocabulary,
  createMongoAnalyticsVisitorStore,
  pruneAnalyticsRateLimitState,
  type AnalyticsRouterOptions,
} from './analytics';
import {
  AnalyticsEventModel,
  analyticsEventIdEvidence,
  scrubLegacyAnalyticsEventIds,
} from '../persistence/models/analytics-event';
import { AnonymousVisitorModel } from '../persistence/models/anonymous-visitor';
import { AnalyticsAttributionClaimModel } from '../persistence/models/analytics-attribution-claim';
import { CalculatorModel } from '../persistence/models/calculator';
import { CalculatorVersionModel } from '../persistence/models/calculator-version';
import { MeasurementRevisionModel } from '../persistence/models/measurement-revision';

const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
  );
});

async function setup(options: AnalyticsRouterOptions) {
  const app = express();
  app.use(express.json());
  app.use(
    '/events',
    createAnalyticsRouter({
      attributionStore: {
        claimSessions: async (sessionIdHashes) => new Set(sessionIdHashes),
      },
      searchVocabulary: {
        canonicalize: async (query) =>
          ['heart-risk', 'cholesterol'].includes(query) ? query : '[other]',
        isPublishedCalculator: async (slug) => ['safe-calculator', 'heart-risk'].includes(slug),
        isVerifiedMeasurement: async (key) => key === 'cholesterol',
        isValidStep: async (slug, step, index) =>
          slug === 'heart-risk' && step === 'labs' && (index === undefined || index === 2),
        isValidParameterUnit: async (slug, parameterKey, unit) =>
          slug === 'heart-risk' && parameterKey === 'ldl' && unit === 'mg/dL',
      },
      ...options,
    }),
  );
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address unavailable');
  return `http://127.0.0.1:${address.port}/events`;
}

function event(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-1',
    type: 'page_view',
    sessionId: 'same-client-value',
    visitorId: 'same-client-value',
    props: { path: '/' },
    ...overrides,
  };
}

async function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
      'accept-language': 'en-IN,en;q=0.9',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('anonymous analytics boundary', () => {
  it('domain-separates hashes and persists only server-derived coarse client dimensions', async () => {
    const saved: Record<string, unknown>[] = [];
    const touched: Record<string, unknown>[] = [];
    const now = new Date('2026-08-28T10:00:00.000Z');
    const url = await setup({
      hashSecret: 'test-secret',
      now: () => now,
      retentionDays: 30,
      visitorPersistence: { enabled: true, retentionDays: 45, consentVersion: 'analytics-v1' },
      store: {
        saveMany: async (events) => {
          saved.push(...events);
          return events.length;
        },
      },
      visitorStore: {
        touchMany: async (visitors) => {
          touched.push(...visitors);
        },
      },
    });
    const response = await post(url, {
      events: [
        event({
          props: {
            path: '/',
            calculatorSlug: 'safe-calculator',
            device: 'mobile',
          },
        }),
      ],
    });
    // `device` is server-derived and is never accepted from a client.
    expect(response.status).toBe(422);

    const accepted = await post(url, { events: [event()] });
    expect(accepted.status).toBe(202);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.eventId).toMatch(/^v1:[a-f\d]{64}$/u);
    expect(saved[0]?.eventId).not.toBe('evt-1');
    expect(saved[0]?.eventIdHashVersion).toBe('hmac-v1');
    expect(saved[0]?.sessionIdHash).not.toBe('same-client-value');
    expect(saved[0]?.visitorIdHash).not.toBe('same-client-value');
    expect(saved[0]?.sessionIdHash).not.toBe(saved[0]?.visitorIdHash);
    expect(saved[0]).toMatchObject({
      device: 'desktop',
      browser: 'Chrome 125',
      os: 'Windows 10',
      locale: 'en-IN',
    });
    expect(saved[0]?.expiresAt).toEqual(new Date('2026-09-27T10:00:00.000Z'));
    expect(touched).toHaveLength(1);
    expect(touched[0]).toMatchObject({ consentVersion: 'analytics-v1' });
  });

  it('discards visitor continuity unless the explicit privacy gate is enabled', async () => {
    const saved: Record<string, unknown>[] = [];
    const touched: Record<string, unknown>[] = [];
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async (events) => void saved.push(...events) },
      visitorStore: { touchMany: async (visitors) => void touched.push(...visitors) },
    });
    expect((await post(url, { events: [event()] })).status).toBe(202);
    expect(saved[0]?.visitorIdHash).toBeUndefined();
    expect(touched).toHaveLength(0);
  });

  it('coalesces out-of-order visitor batches with independent first and last timestamps', async () => {
    const touched: Record<string, unknown>[] = [];
    const now = new Date('2026-08-28T10:00:00.000Z');
    const url = await setup({
      hashSecret: 'test-secret',
      now: () => now,
      visitorPersistence: { enabled: true, retentionDays: 45, consentVersion: 'analytics-v1' },
      store: { saveMany: async (events) => events.length },
      visitorStore: { touchMany: async (visitors) => void touched.push(...visitors) },
    });
    const response = await post(url, {
      events: [
        event({ eventId: 'visitor-late', occurredAt: '2026-08-28T11:00:00.000Z' }),
        event({ eventId: 'visitor-early', occurredAt: '2026-08-28T09:00:00.000Z' }),
      ],
    });
    expect(response.status).toBe(202);
    expect(touched).toHaveLength(1);
    expect(touched[0]).toMatchObject({
      firstSeenAt: new Date('2026-08-28T09:00:00.000Z'),
      lastSeenAt: new Date('2026-08-28T11:00:00.000Z'),
      expiresAt: new Date('2026-10-12T10:00:00.000Z'),
    });
  });

  it('redacts result capabilities and refuses paths carrying query strings', async () => {
    const saved: Record<string, unknown>[] = [];
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async (events) => void saved.push(...events) },
      visitorStore: { touchMany: async () => undefined },
    });
    const response = await post(url, {
      events: [event({ props: { path: '/results/super-secret-share-token' } })],
    });
    expect(response.status).toBe(202);
    expect(saved[0]?.path).toBe('/results/[capability]');
    const rejected = await post(url, {
      events: [
        event({
          eventId: 'evt-2',
          props: { path: '/results/token?shareToken=secret' },
        }),
      ],
    });
    expect(rejected.status).toBe(422);
    for (const unsafePath of ['/patient/person@example.com', '/patient/9876543210']) {
      const unsafe = await post(url, {
        events: [event({ eventId: `unsafe-${unsafePath.length}`, props: { path: unsafePath } })],
      });
      expect(unsafe.status).toBe(422);
    }
  });

  it('rejects unknown health/capability props and contact-like attribution values', async () => {
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async () => undefined },
      visitorStore: { touchMany: async () => undefined },
    });
    for (const props of [
      { path: '/', systolicBloodPressure: 120 },
      { path: '/', shareToken: 'secret' },
      { path: '/', formula: 'a+b' },
      { utmCampaign: 'person@example.com' },
      { utmTerm: '9876543210' },
    ]) {
      const response = await post(url, { events: [event({ props })] });
      expect(response.status).toBe(422);
    }
  });

  it('retains attribution only once per session within a batch and across requests', async () => {
    const saved: Record<string, unknown>[] = [];
    const claimedSessions = new Set<string>();
    const attributionStore = {
      claimSessions: async (sessionIdHashes: readonly string[]) =>
        new Set(
          sessionIdHashes.filter((sessionIdHash) => {
            if (claimedSessions.has(sessionIdHash)) return false;
            claimedSessions.add(sessionIdHash);
            return true;
          }),
        ),
    };
    const url = await setup({
      hashSecret: 'test-secret',
      attributionStore,
      store: {
        saveMany: async (events) => {
          saved.push(...events);
          return events.length;
        },
      },
      visitorStore: { touchMany: async () => undefined },
    });
    const first = await post(url, {
      events: [
        event({
          eventId: 'attribution-first',
          props: {
            path: '/',
            referrerHost: 'first.example',
            utmSource: 'trusted-source',
            utmMedium: 'email',
            utmCampaign: 'first-campaign',
          },
        }),
        event({
          eventId: 'attribution-forged-repeat',
          props: {
            path: '/',
            referrerHost: 'forged.example',
            utmSource: 'forged-source',
            utmMedium: 'forged-medium',
            utmCampaign: 'forged-campaign',
          },
        }),
      ],
    });
    expect(first.status).toBe(202);
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      referrerHost: 'first.example',
      utmSource: 'trusted-source',
      utmMedium: 'email',
      utmCampaign: 'first-campaign',
    });
    expect(saved[1]).not.toHaveProperty('referrerHost');
    expect(saved[1]).not.toHaveProperty('utmSource');
    expect(saved[1]).not.toHaveProperty('utmMedium');
    expect(saved[1]).not.toHaveProperty('utmCampaign');

    const repeat = await post(url, {
      events: [
        event({
          eventId: 'attribution-next-request',
          props: {
            path: '/',
            referrerHost: 'later.example',
            utmSource: 'later-source',
          },
        }),
      ],
    });
    expect(repeat.status).toBe(202);
    expect(saved[2]).not.toHaveProperty('referrerHost');
    expect(saved[2]).not.toHaveProperty('utmSource');
    expect(JSON.stringify(saved)).not.toContain('forged.example');
    expect(JSON.stringify(saved)).not.toContain('later.example');
  });

  it('atomically claims attribution once across concurrent Mongo writers', async () => {
    vi.spyOn(AnalyticsEventModel, 'distinct').mockResolvedValue([]);
    let claimed = false;
    const update = vi.spyOn(AnalyticsAttributionClaimModel, 'updateOne').mockImplementation((async (
      ...arguments_: unknown[]
    ) => {
      const filter = arguments_[0] as Record<string, unknown>;
      if ('$gt' in ((filter.expiresAt as Record<string, unknown>) ?? {})) {
        return { acknowledged: true, matchedCount: 1, modifiedCount: 1 } as never;
      }
      await Promise.resolve();
      if (!claimed) {
        claimed = true;
        return { acknowledged: true, upsertedCount: 1, matchedCount: 0 } as never;
      }
      throw { code: 11_000 };
    }) as never);
    const effectiveNow = new Date('2026-08-28T10:00:00.000Z');
    const expiresAt = new Date('2026-09-28T10:00:00.000Z');
    const store = createMongoAnalyticsAttributionStore();
    const outcomes = await Promise.all([
      store.claimSessions(['a'.repeat(64)], effectiveNow, expiresAt),
      store.claimSessions(['a'.repeat(64)], effectiveNow, expiresAt),
    ]);
    expect(outcomes.filter((outcome) => outcome.has('a'.repeat(64)))).toHaveLength(1);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('persists only verified canonical search identifiers or a fixed other bucket', async () => {
    const saved: Record<string, unknown>[] = [];
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async (events) => void saved.push(...events) },
      visitorStore: { touchMany: async () => undefined },
    });
    const privateQuery = 'Jane Home Address and medical notes';
    const response = await post(url, {
      events: [
        event({
          eventId: 'private-search',
          type: 'search',
          props: { query: privateQuery, zeroResults: true },
        }),
        event({
          eventId: 'known-search',
          type: 'search',
          props: { query: 'heart-risk', zeroResults: false },
        }),
      ],
    });
    expect(response.status).toBe(202);
    expect(saved.map((item) => item.query)).toEqual(['[other]', 'heart-risk']);
    expect(JSON.stringify(saved)).not.toContain(privateQuery);
  });

  it('coalesces a full batch of vocabulary checks into two bounded catalog reads', async () => {
    const query = (items: readonly Record<string, unknown>[]) => ({
      select: () => ({ limit: () => ({ lean: async () => items }) }),
    });
    const calculators = vi
      .spyOn(CalculatorModel, 'find')
      .mockReturnValue(
        query([{ slug: 'heart-risk', currentVersionId: '64c000000000000000000001' }]) as never,
      );
    const versions = vi.spyOn(CalculatorVersionModel, 'find').mockReturnValue(
      query([
        {
          _id: { toString: () => '64c000000000000000000001' },
          payload: {
            uiConfig: { steps: [{ key: 'intro' }, { key: 'history' }, { key: 'labs' }] },
            parameters: [
              {
                key: 'ldl',
                unit: {
                  canonical: 'mg/dL',
                  allowed: [{ code: 'mmol/L' }],
                },
              },
            ],
          },
        },
      ]) as never,
    );
    const measurements = vi
      .spyOn(MeasurementRevisionModel, 'find')
      .mockReturnValue(query([{ key: 'cholesterol' }]) as never);
    const vocabulary = createMongoAnalyticsSearchVocabulary({ ttlMs: 60_000 });
    const values = await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        vocabulary.canonicalize(index % 2 ? 'heart-risk' : 'cholesterol'),
      ),
    );
    expect(new Set(values)).toEqual(new Set(['heart-risk', 'cholesterol']));
    expect(calculators).toHaveBeenCalledTimes(1);
    expect(measurements).toHaveBeenCalledTimes(1);
    expect(versions).toHaveBeenCalledTimes(1);
    await expect(vocabulary.isPublishedCalculator('heart-risk')).resolves.toBe(true);
    await expect(vocabulary.isValidStep('heart-risk', 'labs', 2)).resolves.toBe(true);
    await expect(vocabulary.isValidStep('heart-risk', 'labs', 1)).resolves.toBe(false);
    await expect(vocabulary.isValidParameterUnit('heart-risk', 'ldl', 'mmol/L')).resolves.toBe(
      true,
    );
    await expect(vocabulary.isValidParameterUnit('heart-risk', 'fake', 'mg/dL')).resolves.toBe(
      false,
    );
    expect(calculators).toHaveBeenCalledTimes(1);
  });

  it('migrates legacy event IDs to domain-separated evidence without retaining raw values', async () => {
    const rawId = 'private-capability-like-event-id';
    const secret = 'analytics-secret-for-event-id-migration';
    const query = { select: vi.fn(), lean: vi.fn(), cursor: vi.fn() };
    query.select.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    query.cursor.mockReturnValue(
      (async function* () {
        yield { _id: '64c000000000000000000088', eventId: rawId };
      })(),
    );
    vi.spyOn(AnalyticsEventModel, 'find').mockReturnValue(query as never);
    const bulk = vi.spyOn(AnalyticsEventModel, 'bulkWrite').mockResolvedValue({} as never);

    await expect(scrubLegacyAnalyticsEventIds(secret)).resolves.toBe(1);
    const operations = bulk.mock.calls[0]?.[0];
    expect(operations).toEqual([
      {
        updateOne: {
          filter: {
            _id: '64c000000000000000000088',
            eventIdHashVersion: { $ne: 'hmac-v1' },
          },
          update: {
            $set: {
              eventId: analyticsEventIdEvidence(rawId, secret),
              eventIdHashVersion: 'hmac-v1',
            },
          },
        },
      },
    ]);
    expect(JSON.stringify(operations)).not.toContain(rawId);
  });

  it('accepts bounded feature props and ignores duplicate inserts reported by the store', async () => {
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async () => 0 },
      visitorStore: { touchMany: async () => undefined },
    });
    const response = await post(url, {
      events: [
        event({
          type: 'unit_switch',
          props: {
            calculatorSlug: 'heart-risk',
            unit: 'mg/dL',
            parameterKey: 'ldl',
          },
        }),
      ],
    });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      data: { accepted: 0, duplicates: 1, filteredBots: 0 },
    });
  });

  it('counts exact duplicate IDs inside one batch as duplicates', async () => {
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async (events) => events.length },
      visitorStore: { touchMany: async () => undefined },
    });
    const response = await post(url, { events: [event(), event()] });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      data: { accepted: 1, duplicates: 1, filteredBots: 0 },
    });
  });

  it('reconciles concurrent Mongo duplicate-key races without rejecting telemetry', async () => {
    const eventBulk = vi
      .spyOn(AnalyticsEventModel, 'bulkWrite')
      .mockRejectedValueOnce({ code: 11_000, result: { upsertedCount: 1 } });
    await expect(
      createMongoAnalyticsEventStore().saveMany([{ eventId: 'concurrent-event' }]),
    ).resolves.toBe(1);
    expect(eventBulk).toHaveBeenCalledTimes(1);

    const visitorBulk = vi
      .spyOn(AnonymousVisitorModel, 'bulkWrite')
      .mockRejectedValueOnce({ code: 11_000 })
      .mockResolvedValueOnce({} as never);
    await expect(
      createMongoAnalyticsVisitorStore().touchMany([
        {
          visitorIdHash: 'a'.repeat(64),
          firstSeenAt: new Date('2026-08-28T00:00:00.000Z'),
          lastSeenAt: new Date('2026-08-28T01:00:00.000Z'),
          expiresAt: new Date('2026-09-28T00:00:00.000Z'),
          consentVersion: 'analytics-v1',
        },
      ]),
    ).resolves.toBeUndefined();
    expect(visitorBulk).toHaveBeenCalledTimes(2);
    expect(visitorBulk.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({
        updateOne: expect.objectContaining({ upsert: false }),
      }),
    ]);
  });

  it('enforces event-type semantic props and canonical calculator slugs', async () => {
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async () => undefined },
      visitorStore: { touchMany: async () => undefined },
    });
    const invalid = [
      event({ type: 'page_view', props: {} }),
      event({ type: 'step_view', props: { calculatorSlug: 'heart-risk', step: 'labs' } }),
      event({ type: 'search', props: { query: 'lipids' } }),
      event({
        type: 'unit_switch',
        props: { calculatorSlug: 'heart-risk', parameterKey: 'ldl' },
      }),
      event({ type: 'calc_start', props: { calculatorSlug: 'Heart/Risk' } }),
      event({ type: 'calc_start', props: { calculatorSlug: 'syntactically-valid-fake' } }),
      event({
        type: 'step_view',
        props: { calculatorSlug: 'heart-risk', step: 'fake-step', stepIndex: 2 },
      }),
      event({
        type: 'step_view',
        props: { calculatorSlug: 'heart-risk', step: 'labs', stepIndex: 1 },
      }),
      event({
        type: 'assess_error',
        props: { calculatorSlug: 'heart-risk', step: 'fake-step' },
      }),
      event({
        type: 'unit_switch',
        props: { calculatorSlug: 'heart-risk', parameterKey: 'fake', unit: 'mg/dL' },
      }),
      event({
        type: 'unit_switch',
        props: { calculatorSlug: 'heart-risk', parameterKey: 'ldl', unit: 'fake-unit' },
      }),
      event({
        type: 'page_view',
        props: { path: '/c/heart-risk', calculatorSlug: 'safe-calculator' },
      }),
      event({
        type: 'page_view',
        props: { path: '/', calculatorSlug: 'heart-risk' },
      }),
      event({
        type: 'page_view',
        props: { path: '/biomarkers/ldl', calculatorSlug: 'heart-risk' },
      }),
      event({
        type: 'calc_start',
        props: { path: '/', calculatorSlug: 'heart-risk' },
      }),
      ...['127.0.0.1', '[::1]', '2130706433', '0x7f.0.0.1'].map((referrerHost) =>
        event({ type: 'page_view', props: { path: '/', referrerHost } }),
      ),
      event({ type: 'lead_submit', props: {} }),
    ];
    for (const [index, value] of invalid.entries()) {
      const response = await post(url, {
        events: [{ ...value, eventId: `invalid-${index}` }],
      });
      expect(response.status).toBe(422);
    }
    const valid = await post(url, {
      events: [
        event({
          eventId: 'valid-step',
          type: 'step_view',
          props: { calculatorSlug: 'heart-risk', step: 'labs', stepIndex: 2 },
        }),
        event({
          eventId: 'valid-referrer',
          type: 'page_view',
          props: { path: '/', referrerHost: 'xn--bcher-kva.example' },
        }),
      ],
    });
    expect(valid.status).toBe(202);
  });

  it('rejects short or contact-like public identity values before hashing', async () => {
    const url = await setup({
      hashSecret: 'test-secret',
      store: { saveMany: async () => undefined },
      visitorStore: { touchMany: async () => undefined },
    });
    expect((await post(url, { events: [event({ sessionId: 'short' })] })).status).toBe(422);
    expect(
      (
        await post(url, {
          events: [event({ visitorId: 'person@example.com' })],
        })
      ).status,
    ).toBe(422);
  });

  it('expires limiter identities promptly and hard-bounds active high-cardinality traffic', () => {
    const now = 1_000_000;
    const state = new Map<string, { started: number; count: number }>();
    state.set('expired-network', { started: now - 60_001, count: 1 });
    for (let index = 0; index < 10_000; index += 1) {
      state.set(`active-${index}`, { started: now, count: 1 });
    }
    pruneAnalyticsRateLimitState(state, now);
    expect(state.has('expired-network')).toBe(false);
    expect(state.size).toBeLessThanOrEqual(5_000);
  });

  it('filters bots before identity hashing or persistence', async () => {
    let writes = 0;
    const metrics = new OperationalMetrics();
    const url = await setup({
      hashSecret: 'test-secret',
      metrics,
      store: { saveMany: async () => void (writes += 1) },
      visitorStore: { touchMany: async () => void (writes += 1) },
    });
    const response = await post(
      url,
      { events: [event()] },
      { 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' },
    );
    expect(response.status).toBe(202);
    expect(writes).toBe(0);
    expect(metrics.snapshot().eventIngest.filteredBots).toBe(1);
  });

  it('refuses ingestion when the server-side hashing secret is absent', async () => {
    const url = await setup({});
    const response = await post(url, { events: [event()] });
    expect(response.status).toBe(503);
  });
});
