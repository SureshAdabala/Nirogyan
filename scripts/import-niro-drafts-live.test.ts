import { describe, expect, it } from 'vitest';

import { stableMeasurementHash } from '../apps/server/src/modules/measurement-contract';

import {
  authorizeLiveDraftImport,
  executeLiveDraftImport,
  materializeIntendedLiveDrafts,
  preflightExistingDrafts,
  readCoreMeasurementSeed,
  resolveDraftMeasurementBindings,
  type AdminMeasurementRevision,
  type ExistingCalculatorSummary,
  type ExistingCalculatorVersion,
  type IntendedLiveDraft,
  type LiveImportEnvironment,
} from './import-niro-drafts-live';
import { reconcileNiroDrafts, sha256Text, stableP8Json } from './reconcile-niro-drafts';

const SECRET_PASSWORD = 'test-password-that-must-never-be-logged';
const SECRET_RESPONSE_MARKER = 'server-body-secret-that-must-stay-redacted';
const ACCESS_TOKEN = 'test-access-token-that-must-remain-in-memory';
const BASE_ARGS = [
  '--allow-live-draft-import',
  '--expected-node-env=development',
  '--expected-db-name=niro_p8_live_test',
] as const;
const BASE_ENVIRONMENT: LiveImportEnvironment = {
  NODE_ENV: 'development',
  PORT: '4000',
  MONGODB_URI: 'mongodb://example.invalid/ignored-by-harness',
  MONGODB_DB_NAME: 'niro_p8_live_test',
  ADMIN_BOOTSTRAP_EMAIL: 'admin@example.test',
  ADMIN_BOOTSTRAP_PASSWORD: SECRET_PASSWORD,
};

interface StoredDraft {
  readonly calculator: ExistingCalculatorSummary;
  readonly version: ExistingCalculatorVersion;
}

interface MockApi {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: {
    readonly method: string;
    readonly path: string;
    readonly authorization?: string;
  }[];
  readonly stored: Map<string, StoredDraft>;
}

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...Object.fromEntries(new Headers(headers)) },
  });
}

function measurementRows(): readonly AdminMeasurementRevision[] {
  return [...readCoreMeasurementSeed().entries()].map(([key, record], index) => ({
    id: (index + 1).toString(16).padStart(24, '0'),
    key,
    revision: 3,
    status: 'draft',
    definitionHash: stableMeasurementHash(record.definition),
    definition: structuredClone(record.definition),
  }));
}

function intendedDrafts(
  rows: readonly AdminMeasurementRevision[] = measurementRows(),
): readonly IntendedLiveDraft[] {
  const drafts = reconcileNiroDrafts();
  return materializeIntendedLiveDrafts(drafts, resolveDraftMeasurementBindings(drafts, rows));
}

function storedDraft(intended: IntendedLiveDraft, ordinal: number): StoredDraft {
  const calculatorId = (10_000 + ordinal).toString(16).padStart(24, 'a');
  const versionId = (20_000 + ordinal).toString(16).padStart(24, 'b');
  const version: ExistingCalculatorVersion = {
    id: versionId,
    calculatorSlug: intended.calculatorSlug,
    version: 1,
    status: 'draft',
    payload: structuredClone(intended.payload),
    measurements: {
      revisionIds: [...intended.measurementRevisionIds],
      count: intended.measurementRevisionIds.length,
    },
  };
  return {
    calculator: {
      id: calculatorId,
      slug: intended.calculatorSlug,
      name: intended.name,
      status: 'draft',
      draftVersionId: versionId,
    },
    version,
  };
}

function createMockApi(
  options: {
    readonly rows?: readonly AdminMeasurementRevision[];
    readonly initialDrafts?: readonly IntendedLiveDraft[];
    readonly failLogin?: boolean;
    readonly loseFirstCreateResponseAfterCommit?: boolean;
  } = {},
): MockApi {
  const calls: MockApi['calls'][number][] = [];
  const stored = new Map<string, StoredDraft>();
  for (const [index, intended] of (options.initialDrafts ?? []).entries()) {
    stored.set(intended.calculatorSlug, storedDraft(intended, index));
  }
  let lostResponse = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    calls.push({
      method,
      path: url.pathname,
      authorization: headers.get('authorization') ?? undefined,
    });

    if (method === 'POST' && url.pathname === '/api/v1/admin/auth/login') {
      if (options.failLogin) {
        return jsonResponse(
          {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: `${SECRET_RESPONSE_MARKER}:${SECRET_PASSWORD}:${ACCESS_TOKEN}`,
            },
          },
          401,
        );
      }
      return jsonResponse({ data: { user: { id: 'admin', role: 'admin' } } }, 200, {
        'set-cookie': `niro_access=${encodeURIComponent(ACCESS_TOKEN)}; HttpOnly; Path=/`,
      });
    }

    expect(headers.get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(headers.has('cookie')).toBe(false);
    expect(headers.has('x-csrf-token')).toBe(false);

    if (method === 'GET' && url.pathname === '/api/v1/admin/biomarkers') {
      return jsonResponse({ data: options.rows ?? measurementRows() });
    }
    if (method === 'GET' && url.pathname === '/api/v1/admin/calculators') {
      return jsonResponse({ data: [...stored.values()].map((entry) => entry.calculator) });
    }
    const versionsMatch = url.pathname.match(/^\/api\/v1\/admin\/calculators\/([^/]+)\/versions$/u);
    if (method === 'GET' && versionsMatch) {
      const slug = decodeURIComponent(versionsMatch[1] ?? '');
      const found = stored.get(slug);
      return jsonResponse({ data: found ? [found.version] : [] });
    }
    if (method === 'POST' && url.pathname === '/api/v1/admin/calculators') {
      expect(headers.get('idempotency-key')).toMatch(/^p8-draft:/u);
      const request = JSON.parse(String(init?.body)) as {
        readonly slug: string;
        readonly name: string;
        readonly payload: Record<string, unknown>;
        readonly measurementRevisionIds: readonly string[];
      };
      if (stored.has(request.slug)) {
        return jsonResponse({ error: { code: 'CALCULATOR_EXISTS' } }, 409);
      }
      const intended: IntendedLiveDraft = {
        calculatorSlug: request.slug,
        name: request.name,
        payload: request.payload,
        measurementRevisionIds: request.measurementRevisionIds,
        fixtureSha256: 'fixture-hash-not-used-by-mock',
        reconciledPayloadSha256: 'reconciled-hash-not-used-by-mock',
        intendedPayloadSha256: sha256Text(stableP8Json(request.payload)),
      };
      const persisted = storedDraft(intended, stored.size + 100);
      stored.set(request.slug, persisted);
      if (options.loseFirstCreateResponseAfterCommit && !lostResponse) {
        lostResponse = true;
        throw new TypeError('simulated response loss after commit');
      }
      return jsonResponse({ data: persisted }, 201);
    }
    return jsonResponse({ error: { code: 'NOT_FOUND' } }, 404);
  };
  return { fetch, calls, stored };
}

describe('P8 guarded live draft import authorization', () => {
  it('requires an explicit opt-in, exact environment/database guards, MongoDB, and loopback API', () => {
    expect(() => authorizeLiveDraftImport(BASE_ARGS.slice(1), BASE_ENVIRONMENT)).toThrow(
      '--allow-live-draft-import',
    );
    expect(() =>
      authorizeLiveDraftImport(BASE_ARGS, { ...BASE_ENVIRONMENT, NODE_ENV: 'production' }),
    ).toThrow('prohibited in production');
    expect(() =>
      authorizeLiveDraftImport(BASE_ARGS, {
        ...BASE_ENVIRONMENT,
        MONGODB_DB_NAME: 'different_database',
      }),
    ).toThrow('does not exactly match');
    expect(() =>
      authorizeLiveDraftImport(BASE_ARGS, { ...BASE_ENVIRONMENT, MONGODB_URI: undefined }),
    ).toThrow('MONGODB_URI');
    expect(() =>
      authorizeLiveDraftImport(
        [...BASE_ARGS, '--api-url=https://admin.example.com'],
        BASE_ENVIRONMENT,
      ),
    ).toThrow('loopback');
    expect(() =>
      authorizeLiveDraftImport(BASE_ARGS, {
        ...BASE_ENVIRONMENT,
        ADMIN_BOOTSTRAP_PASSWORD: undefined,
      }),
    ).toThrow('ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD');
  });

  it('accepts only the exact explicitly named non-production target', () => {
    const authorized = authorizeLiveDraftImport(
      [...BASE_ARGS, '--api-url=http://localhost:4100'],
      BASE_ENVIRONMENT,
    );
    expect(authorized.nodeEnv).toBe('development');
    expect(authorized.databaseName).toBe('niro_p8_live_test');
    expect(authorized.apiBaseUrl.origin).toBe('http://localhost:4100');
  });
});

describe('P8 measurement binding and source preservation', () => {
  it('uses the persistence layer canonical measurement hash, not a local JSON variant', () => {
    const record = readCoreMeasurementSeed().get('hdl-cholesterol');
    expect(record).toBeDefined();
    expect(measurementRows().find((row) => row.key === 'hdl-cholesterol')?.definitionHash).toBe(
      stableMeasurementHash(record?.definition),
    );
    expect(stableMeasurementHash(record?.definition)).not.toBe(
      sha256Text(stableP8Json(record?.definition)),
    );
  });

  it('binds every biomarker key to the exact latest unapproved seed/core draft revision 3', () => {
    const drafts = reconcileNiroDrafts();
    const bindings = resolveDraftMeasurementBindings(drafts, measurementRows());
    expect(
      bindings.map((binding) => [binding.calculatorSlug, binding.biomarkerKeys.length]),
    ).toEqual([
      ['diabetes-risk', 0],
      ['heart-risk', 5],
      ['hypothyroid-risk', 0],
      ['niro-cws', 40],
    ]);
    expect(
      bindings.every((binding) => binding.dependencyStatus === 'unapproved-draft-revision-3'),
    ).toBe(true);
  });

  it('fails closed on missing coverage or a later persisted revision', () => {
    const drafts = reconcileNiroDrafts();
    const rows = measurementRows();
    expect(() =>
      resolveDraftMeasurementBindings(
        drafts,
        rows.filter((row) => row.key !== 'albumin'),
      ),
    ).toThrow('albumin');
    const albumin = rows.find((row) => row.key === 'albumin');
    expect(albumin).toBeDefined();
    expect(() =>
      resolveDraftMeasurementBindings(drafts, [
        ...rows,
        { ...albumin!, id: 'f'.repeat(24), revision: 4 },
      ]),
    ).toThrow('latest persisted measurement revision');
  });

  it('preserves reconciled and fixture hashes plus source metadata while making an intended v1 draft', () => {
    const drafts = reconcileNiroDrafts();
    const intended = materializeIntendedLiveDrafts(
      drafts,
      resolveDraftMeasurementBindings(drafts, measurementRows()),
    );
    for (const item of intended) {
      const original = drafts.find((draft) => draft.calculatorSlug === item.calculatorSlug);
      expect(original).toBeDefined();
      expect(item.fixtureSha256).toBe(original?.fixtureSha256);
      expect(item.reconciledPayloadSha256).toBe(original?.payloadSha256);
      expect(stableP8Json(item.payload.sources)).toBe(stableP8Json(original?.payload.sources));
      expect(item.payload.version).toBe(1);
      expect(item.payload.status).toBe('draft');
    }
  });
});

describe('P8 existing-state preflight and API execution', () => {
  it('treats exact v1 draft payloads and bindings as no-ops', async () => {
    const intended = intendedDrafts();
    const api = createMockApi({ initialDrafts: intended });
    const result = await executeLiveDraftImport({
      args: BASE_ARGS,
      environment: BASE_ENVIRONMENT,
      fetchImplementation: api.fetch,
    });
    expect(result.drafts.map((draft) => draft.outcome)).toEqual([
      'no-op',
      'no-op',
      'no-op',
      'no-op',
    ]);
    expect(
      api.calls.filter(
        (call) => call.method === 'POST' && call.path === '/api/v1/admin/calculators',
      ),
    ).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(SECRET_PASSWORD);
  });

  it('fails all calculator writes before starting when any existing target drifts', async () => {
    const intended = intendedDrafts();
    const api = createMockApi({ initialDrafts: [intended[0]!] });
    const first = api.stored.get(intended[0]!.calculatorSlug);
    expect(first).toBeDefined();
    const drifted: StoredDraft = {
      calculator: first!.calculator,
      version: {
        ...first!.version,
        payload: { ...first!.version.payload, name: 'Drifted payload' },
      },
    };
    api.stored.set(intended[0]!.calculatorSlug, drifted);
    await expect(
      executeLiveDraftImport({
        args: BASE_ARGS,
        environment: BASE_ENVIRONMENT,
        fetchImplementation: api.fetch,
      }),
    ).rejects.toThrow('payload, binding, or version drift');
    expect(
      api.calls.filter(
        (call) => call.method === 'POST' && call.path === '/api/v1/admin/calculators',
      ),
    ).toHaveLength(0);
  });

  it('requires exact measurement coverage for all four before the calculator preflight or writes', async () => {
    const api = createMockApi({ rows: measurementRows().filter((row) => row.key !== 'albumin') });
    await expect(
      executeLiveDraftImport({
        args: BASE_ARGS,
        environment: BASE_ENVIRONMENT,
        fetchImplementation: api.fetch,
      }),
    ).rejects.toThrow('albumin');
    expect(api.calls.some((call) => call.path === '/api/v1/admin/calculators')).toBe(false);
  });

  it('redacts credentials, tokens, and error-body messages', async () => {
    const api = createMockApi({ failLogin: true });
    let reported = '';
    try {
      await executeLiveDraftImport({
        args: BASE_ARGS,
        environment: BASE_ENVIRONMENT,
        fetchImplementation: api.fetch,
      });
    } catch (error) {
      reported = error instanceof Error ? error.message : String(error);
    }
    expect(reported).toContain('HTTP 401, code INVALID_CREDENTIALS');
    expect(reported).not.toContain(SECRET_PASSWORD);
    expect(reported).not.toContain(SECRET_RESPONSE_MARKER);
    expect(reported).not.toContain(ACCESS_TOKEN);
  });

  it('is safely rerunnable after a committed write whose response is lost', async () => {
    const api = createMockApi({ loseFirstCreateResponseAfterCommit: true });
    await expect(
      executeLiveDraftImport({
        args: BASE_ARGS,
        environment: BASE_ENVIRONMENT,
        fetchImplementation: api.fetch,
      }),
    ).rejects.toThrow('Write outcome for diabetes-risk is unknown');
    expect(api.stored.has('diabetes-risk')).toBe(true);

    const rerun = await executeLiveDraftImport({
      args: BASE_ARGS,
      environment: BASE_ENVIRONMENT,
      fetchImplementation: api.fetch,
    });
    expect(rerun.drafts.map((draft) => [draft.calculatorSlug, draft.outcome])).toEqual([
      ['diabetes-risk', 'no-op'],
      ['heart-risk', 'created'],
      ['hypothyroid-risk', 'created'],
      ['niro-cws', 'created'],
    ]);
    expect(api.stored.size).toBe(4);
  });

  it('rejects a mismatched existing set in the pure preflight before creation', () => {
    const intended = intendedDrafts();
    const existing = storedDraft(intended[1]!, 1);
    expect(() =>
      preflightExistingDrafts(intended, {
        calculators: [existing.calculator],
        versionsBySlug: {
          [intended[1]!.calculatorSlug]: [
            {
              ...existing.version,
              measurements: { ...existing.version.measurements, revisionIds: [] },
            },
          ],
        },
      }),
    ).toThrow('payload, binding, or version drift');
  });
});
