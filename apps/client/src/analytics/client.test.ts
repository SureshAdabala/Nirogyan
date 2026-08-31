import { describe, expect, it, vi } from 'vitest';

import { ANALYTICS_EVENT_TYPES, analyticsEndpoint, createAnalyticsClient } from './client';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    values,
  };
}

async function blobJson(blob: Blob) {
  return JSON.parse(await blob.text()) as { readonly events: readonly Record<string, unknown>[] };
}

function opaqueId(sequence: number): string {
  return `opaque_${String(sequence).padStart(16, '0')}`;
}

describe('privacy-safe analytics client', () => {
  it('does not offer a correlatable lead-submission client event', () => {
    expect(ANALYTICS_EVENT_TYPES).not.toContain('lead_submit');
  });
  it('resolves only absolute HTTP(S) API endpoints', () => {
    expect(analyticsEndpoint('https://api.example.test/api/v1/')).toBe(
      'https://api.example.test/api/v1/events',
    );
    expect(analyticsEndpoint('javascript:alert(1)')).toBeUndefined();
    expect(analyticsEndpoint('/api/v1')).toBeUndefined();
  });

  it('uses an inactivity-scoped session without creating a persistent visitor by default', async () => {
    const local = storage();
    const session = storage();
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      localStorage: local,
      sessionStorage: session,
      now: () => Date.UTC(2026, 7, 28),
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('search', { path: '/', query: 'person@example.test', zeroResults: true });
    await client.flush();
    const event = (await blobJson(sent[0]!)).events[0]!;
    expect(event.sessionId).toBe(opaqueId(1));
    expect(event.visitorId).toBeUndefined();
    expect(local.values.size).toBe(0);
    expect((event.props as Record<string, unknown>).query).toBe('[redacted]');
  });

  it('expires approved visitor identity after a full retention window without activity', async () => {
    const local = storage();
    const session = storage();
    const payloads: Blob[] = [];
    let at = 1_000;
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: true,
      visitorConsentVersion: 'privacy-v1',
      visitorRetentionDays: 1,
      localStorage: local,
      sessionStorage: session,
      now: () => at,
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        payloads.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    await client.flush();
    at += 86_400_001;
    client.track('page_view', { path: '/' });
    await client.flush();
    const first = (await blobJson(payloads[0]!)).events[0]!;
    const second = (await blobJson(payloads[1]!)).events[0]!;
    expect(first.visitorId).toBe(opaqueId(3));
    expect(second.visitorId).not.toBe(first.visitorId);
  });

  it('rotates a session after inactivity and never forwards unknown or health-valued props', async () => {
    const session = storage();
    const sent: Blob[] = [];
    let at = 10_000;
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: session,
      sessionTimeoutMs: 1_000,
      now: () => at,
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('unit_switch', {
      calculatorSlug: 'heart-risk',
      parameterKey: 'cholesterol',
      unit: 'mmol/L',
      ...({ healthValue: 8.4, shareToken: 'secret' } as Record<string, unknown>),
    });
    await client.flush();
    at += 1_001;
    client.track('unit_switch', {
      calculatorSlug: 'heart-risk',
      parameterKey: 'cholesterol',
      unit: 'mg/dL',
    });
    await client.flush();
    const first = (await blobJson(sent[0]!)).events[0]!;
    const second = (await blobJson(sent[1]!)).events[0]!;
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(first.props).toEqual({
      calculatorSlug: 'heart-risk',
      parameterKey: 'cholesterol',
      unit: 'mmol/L',
    });
  });

  it('falls back to a keepalive fetch when sendBeacon declines the batch', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 202 }));
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sendBeacon: () => false,
      fetcher,
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    expect(await client.flush()).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/events',
      expect.objectContaining({ keepalive: true, credentials: 'omit' }),
    );
  });

  it('requires a versioned approval before persisting visitors and rotates on policy change', async () => {
    const local = storage();
    const session = storage();
    const sent: Blob[] = [];
    let sequence = 0;
    const base = {
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: true,
      visitorRetentionDays: 90,
      localStorage: local,
      sessionStorage: session,
      now: () => 2_000,
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url: string, body: Blob) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    };
    const unapproved = createAnalyticsClient(base);
    unapproved.track('page_view', { path: '/' });
    await unapproved.flush();
    expect((await blobJson(sent[0]!)).events[0]!.visitorId).toBeUndefined();
    expect(local.values.size).toBe(0);

    const approvedV1 = createAnalyticsClient({ ...base, visitorConsentVersion: 'privacy-v1' });
    approvedV1.track('page_view', { path: '/' });
    await approvedV1.flush();
    const firstApproved = (await blobJson(sent[1]!)).events[0]!.visitorId;
    expect(firstApproved).toBeDefined();

    const approvedV2 = createAnalyticsClient({ ...base, visitorConsentVersion: 'privacy-v2' });
    approvedV2.track('page_view', { path: '/' });
    await approvedV2.flush();
    expect((await blobJson(sent[2]!)).events[0]!.visitorId).not.toBe(firstApproved);
  });

  it('drops PII-like campaign dimensions and all non-allowlisted health or capability values', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', {
      path: '/results/[capability]',
      utmSource: 'person@example.test',
      utmMedium: 'safe-organic',
      utmCampaign: 'account-123456789',
      ...({
        utmTerm: 'must-not-collect-term',
        utmContent: 'must-not-collect-content',
        healthValue: 211,
        shareToken: 'secret-capability',
      } as Record<string, unknown>),
    });
    await client.flush();
    expect((await blobJson(sent[0]!)).events[0]!.props).toEqual({
      path: '/results/[capability]',
      utmMedium: 'safe-organic',
    });
    expect(await sent[0]!.text()).not.toContain('secret-capability');
    expect(await sent[0]!.text()).not.toContain('person@example.test');
    expect(await sent[0]!.text()).not.toContain('123456789');
    expect(await sent[0]!.text()).not.toContain('must-not-collect-term');
    expect(await sent[0]!.text()).not.toContain('must-not-collect-content');
  });

  it('rejects IP-literal referrers while retaining ordinary DNS and punycode hosts', async () => {
    async function capturedReferrer(referrerHost: string): Promise<unknown> {
      const sent: Blob[] = [];
      let sequence = 0;
      const client = createAnalyticsClient({
        enabled: true,
        endpoint: 'https://api.example.test/api/v1/events',
        persistentVisitor: false,
        sessionStorage: storage(),
        randomId: () => opaqueId(++sequence),
        sendBeacon: (_url, body) => {
          sent.push(body);
          return true;
        },
        setTimer: () => ({}) as ReturnType<typeof setTimeout>,
        clearTimer: () => undefined,
      });
      client.track('page_view', { path: '/', referrerHost });
      await client.flush();
      return ((await blobJson(sent[0]!)).events[0]!.props as Record<string, unknown>).referrerHost;
    }

    await expect(capturedReferrer('127.0.0.1')).resolves.toBeUndefined();
    await expect(capturedReferrer('[2001:db8::1]')).resolves.toBeUndefined();
    await expect(capturedReferrer('2130706433')).resolves.toBeUndefined();
    await expect(capturedReferrer('search.example')).resolves.toBe('search.example');
    await expect(capturedReferrer('xn--bcher-kva.example')).resolves.toBe('xn--bcher-kva.example');
  });

  it('attaches referrer and campaign context exactly once per inactivity session', async () => {
    const session = storage();
    const sent: Blob[] = [];
    let sequence = 0;
    const create = () =>
      createAnalyticsClient({
        enabled: true,
        endpoint: 'https://api.example.test/api/v1/events',
        persistentVisitor: false,
        sessionStorage: session,
        randomId: () => opaqueId(++sequence),
        sessionContext: () => ({
          referrerHost: 'search.example',
          utmSource: 'organic',
          utmCampaign: 'launch',
        }),
        sendBeacon: (_url, body) => {
          sent.push(body);
          return true;
        },
        setTimer: () => ({}) as ReturnType<typeof setTimeout>,
        clearTimer: () => undefined,
      });
    const firstClient = create();
    firstClient.track('calc_start', { calculatorSlug: 'heart-risk' });
    await firstClient.flush();
    firstClient.track('step_view', {
      calculatorSlug: 'heart-risk',
      step: 'labs',
      stepIndex: 0,
      utmSource: 'must-not-repeat',
    });
    await firstClient.flush();
    const reloadClient = create();
    reloadClient.track('page_view', { path: '/c/heart-risk' });
    await reloadClient.flush();

    const first = (await blobJson(sent[0]!)).events[0]!.props as Record<string, unknown>;
    const second = (await blobJson(sent[1]!)).events[0]!.props as Record<string, unknown>;
    const afterReload = (await blobJson(sent[2]!)).events[0]!.props as Record<string, unknown>;
    expect(first).toMatchObject({
      referrerHost: 'search.example',
      utmSource: 'organic',
      utmCampaign: 'launch',
    });
    expect(second.utmSource).toBeUndefined();
    expect(afterReload.utmSource).toBeUndefined();
    expect(afterReload.referrerHost).toBeUndefined();
  });

  it('still attributes a new inactivity session when its first event is not attribution-eligible', async () => {
    const session = storage();
    const sent: Blob[] = [];
    let at = 1_000;
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: session,
      sessionTimeoutMs: 1_000,
      now: () => at,
      randomId: () => opaqueId(++sequence),
      sessionContext: () => ({ referrerHost: 'search.example', utmSource: 'organic' }),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    await client.flush();
    at += 1_001;
    client.track('step_view', {
      calculatorSlug: 'heart-risk',
      step: 'labs',
      stepIndex: 0,
    });
    await client.flush();
    client.track('page_view', { path: '/c/heart-risk', calculatorSlug: 'heart-risk' });
    await client.flush();

    const newSessionPage = (await blobJson(sent[2]!)).events[0]!.props;
    expect(newSessionPage).toMatchObject({
      referrerHost: 'search.example',
      utmSource: 'organic',
    });
  });

  it('does not consume session attribution when an unsupported route is dropped', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sessionContext: () => ({ referrerHost: 'search.example', utmSource: 'organic' }),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/unknown/private/route' });
    client.track('page_view', { path: '/biomarkers' });
    await client.flush();

    const events = (await blobJson(sent[0]!)).events;
    expect(events).toHaveLength(1);
    expect(events[0]!.props).toMatchObject({
      path: '/biomarkers',
      referrerHost: 'search.example',
      utmSource: 'organic',
    });
  });

  it('does not consume session attribution when event ID generation fails', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => {
        sequence += 1;
        if (sequence === 2) throw new Error('Random event ID failed.');
        return opaqueId(sequence);
      },
      sessionContext: () => ({ referrerHost: 'search.example', utmCampaign: 'launch' }),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    client.track('page_view', { path: '/biomarkers' });
    await client.flush();

    const events = (await blobJson(sent[0]!)).events;
    expect(events).toHaveLength(1);
    expect(events[0]!.sessionId).toBe(opaqueId(3));
    expect(events[0]!.props).toMatchObject({
      path: '/biomarkers',
      referrerHost: 'search.example',
      utmCampaign: 'launch',
    });
  });

  it('keeps a bounded in-memory session when session storage writes fail', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('Denied', 'SecurityError');
        },
        removeItem: () => undefined,
      },
      randomId: () => opaqueId(++sequence),
      sessionContext: () => ({ referrerHost: 'search.example', utmSource: 'organic' }),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    client.track('step_view', {
      calculatorSlug: 'heart-risk',
      step: 'labs',
      stepIndex: 0,
    });
    await client.flush();

    const events = (await blobJson(sent[0]!)).events;
    expect(events).toHaveLength(2);
    expect(events[1]!.sessionId).toBe(events[0]!.sessionId);
    expect(events[0]!.props).toMatchObject({ utmSource: 'organic' });
    expect(events[1]!.props).not.toHaveProperty('utmSource');
  });

  it('omits persistent visitor identity when local storage reads fail', async () => {
    const sent: Blob[] = [];
    const setItem = vi.fn();
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: true,
      visitorRetentionDays: 90,
      visitorConsentVersion: 'privacy-v1',
      localStorage: {
        getItem: () => {
          throw new DOMException('Denied', 'SecurityError');
        },
        setItem,
        removeItem: () => undefined,
      },
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    await client.flush();

    expect((await blobJson(sent[0]!)).events[0]!.visitorId).toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('omits persistent visitor identity when local storage writes fail', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: true,
      visitorRetentionDays: 90,
      visitorConsentVersion: 'privacy-v1',
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('Denied', 'SecurityError');
        },
        removeItem: () => undefined,
      },
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    client.track('page_view', { path: '/biomarkers' });
    await client.flush();

    const events = (await blobJson(sent[0]!)).events;
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.visitorId === undefined)).toBe(true);
    expect(events[1]!.sessionId).toBe(events[0]!.sessionId);
  });

  it('drops unsupported routes locally instead of poisoning an ingest batch', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/unknown/private/route' });
    client.track('page_view', { path: '/biomarkers' });
    await client.flush();
    const events = (await blobJson(sent[0]!)).events;
    expect(events).toHaveLength(1);
    expect(events[0]!.props).toEqual({ path: '/biomarkers' });
  });

  it('removes a stale persistent visitor identity when approval is disabled', async () => {
    const local = storage();
    const session = storage();
    let sequence = 0;
    const approved = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: true,
      visitorRetentionDays: 90,
      visitorConsentVersion: 'privacy-v1',
      localStorage: local,
      sessionStorage: session,
      randomId: () => opaqueId(++sequence),
      sendBeacon: () => true,
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    approved.track('page_view', { path: '/' });
    await approved.flush();
    expect(local.values.size).toBe(1);

    createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      localStorage: local,
      sessionStorage: session,
    });
    expect(local.values.size).toBe(0);
  });

  it('slides the approved visitor expiry on activity without changing identity', async () => {
    const local = storage();
    const session = storage();
    const sent: Blob[] = [];
    let at = 1_000;
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: true,
      visitorRetentionDays: 1,
      visitorConsentVersion: 'privacy-v1',
      localStorage: local,
      sessionStorage: session,
      now: () => at,
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    await client.flush();
    at += 12 * 60 * 60 * 1_000;
    client.track('page_view', { path: '/biomarkers' });
    await client.flush();
    at += 18 * 60 * 60 * 1_000;
    client.track('page_view', { path: '/c/heart-risk', calculatorSlug: 'heart-risk' });
    await client.flush();
    const visitors = await Promise.all(
      sent.map(async (batch) => (await blobJson(batch)).events[0]!.visitorId),
    );
    expect(new Set(visitors).size).toBe(1);
  });

  it('replaces malformed stored opaque identities before sending', async () => {
    const session = storage();
    session.setItem(
      'niro.analytics.session.v1',
      JSON.stringify({ id: 'short', lastSeenAt: Date.now(), attributionSent: true }),
    );
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: session,
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    await client.flush();
    expect((await blobJson(sent[0]!)).events[0]!.sessionId).toBe(opaqueId(1));
  });

  it('schedules a bounded background retry after a transport failure', async () => {
    const setTimer = vi.fn((callback: () => void, delay: number) => {
      void callback;
      void delay;
      return {} as ReturnType<typeof setTimeout>;
    });
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      fetcher: vi.fn(async () => new Response(null, { status: 503 })),
      setTimer,
      clearTimer: () => undefined,
    });
    client.track('page_view', { path: '/' });
    expect(await client.flush()).toBe(false);
    expect(setTimer).toHaveBeenCalledTimes(2);
    expect(setTimer.mock.calls[1]?.[1]).toBe(2_000);
  });

  it('enqueues only server-compatible funnel, share, and retake semantics', async () => {
    const sent: Blob[] = [];
    let sequence = 0;
    const client = createAnalyticsClient({
      enabled: true,
      endpoint: 'https://api.example.test/api/v1/events',
      persistentVisitor: false,
      sessionStorage: storage(),
      randomId: () => opaqueId(++sequence),
      sendBeacon: (_url, body) => {
        sent.push(body);
        return true;
      },
      setTimer: () => ({}) as ReturnType<typeof setTimeout>,
      clearTimer: () => undefined,
    });
    client.track('step_view', { calculatorSlug: 'heart-risk', step: 'labs' });
    client.track('share', { calculatorSlug: 'heart-risk' });
    client.track('step_view', {
      calculatorSlug: 'heart-risk',
      step: 'labs',
      stepIndex: 1,
    });
    client.track('share', { calculatorSlug: 'heart-risk', action: 'copy' });
    client.track('share_open', {
      calculatorSlug: 'heart-risk',
      path: '/results/raw-secret-token',
      action: 'open',
    });
    client.track('retake', { calculatorSlug: 'heart-risk', action: 'retake' });
    await client.flush();
    const events = (await blobJson(sent[0]!)).events;
    expect(events.map((event) => event.type)).toEqual([
      'step_view',
      'share',
      'share_open',
      'retake',
    ]);
    expect(events[2]!.props).toEqual({
      calculatorSlug: 'heart-risk',
      path: '/results/[capability]',
      action: 'open',
    });
  });
});
