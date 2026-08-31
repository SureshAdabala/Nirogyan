// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import {
  AnalyticsProvider,
  analyticsPageContext,
  analyticsReferrerHost,
  parseVisitorRetentionDays,
} from './AnalyticsProvider';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('AnalyticsProvider privacy boundaries', () => {
  it('attaches calculator identity and normalizes capability paths without retaining tokens', () => {
    expect(analyticsPageContext('/c/heart-risk')).toEqual({
      path: '/c/heart-risk',
      calculatorSlug: 'heart-risk',
    });
    expect(analyticsPageContext('/results/super-secret-capability')).toEqual({
      path: '/results/[capability]',
    });
    expect(JSON.stringify(analyticsPageContext('/results/super-secret-capability'))).not.toContain(
      'super-secret-capability',
    );
  });

  it('accepts only positive safe-integer visitor retention windows', () => {
    expect(parseVisitorRetentionDays('90')).toBe(90);
    expect(parseVisitorRetentionDays('0')).toBeUndefined();
    expect(parseVisitorRetentionDays('-1')).toBeUndefined();
    expect(parseVisitorRetentionDays('1.5')).toBeUndefined();
    expect(parseVisitorRetentionDays('999999999999999999999')).toBeUndefined();
  });

  it('keeps only cross-origin referrer hosts', () => {
    expect(
      analyticsReferrerHost('https://search.example/results?q=health', 'https://niro.example'),
    ).toBe('search.example');
    expect(
      analyticsReferrerHost('https://niro.example/biomarkers', 'https://niro.example'),
    ).toBeUndefined();
    expect(analyticsReferrerHost('not a url', 'https://niro.example')).toBeUndefined();
  });

  it('sends with an in-memory session when the session-storage getter is denied', async () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/api/v1');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS', '90');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION', 'privacy-v1');
    window.localStorage.clear();
    const sessionDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    const beaconDescriptor = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon');
    const sent: Blob[] = [];
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Denied', 'SecurityError');
      },
    });
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn((_url: string, body: Blob) => {
        sent.push(body);
        return true;
      }),
    });
    try {
      const view = render(
        <AnalyticsProvider>
          <p>Calculator remains available</p>
        </AnalyticsProvider>,
      );
      expect(screen.getByText('Calculator remains available')).toBeVisible();
      view.unmount();
      await waitFor(() => expect(sent).toHaveLength(1));
      const payload = JSON.parse(await sent[0]!.text()) as {
        events: readonly { sessionId?: string; visitorId?: string }[];
      };
      expect(payload.events[0]?.sessionId).toEqual(expect.any(String));
      expect(payload.events[0]?.visitorId).toBeUndefined();
    } finally {
      if (sessionDescriptor) Object.defineProperty(window, 'sessionStorage', sessionDescriptor);
      if (beaconDescriptor) Object.defineProperty(navigator, 'sendBeacon', beaconDescriptor);
      else delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    }
  });

  it('keeps session telemetry when the persistent-storage getter is denied', async () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/api/v1');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS', '90');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION', 'privacy-v1');
    window.sessionStorage.clear();
    const localDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const beaconDescriptor = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon');
    const sent: Blob[] = [];
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Denied', 'SecurityError');
      },
    });
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn((_url: string, body: Blob) => {
        sent.push(body);
        return true;
      }),
    });
    try {
      const view = render(
        <AnalyticsProvider>
          <p>Session analytics remains available</p>
        </AnalyticsProvider>,
      );
      view.unmount();
      await waitFor(() => expect(sent).toHaveLength(1));
      const payload = JSON.parse(await sent[0]!.text()) as {
        events: readonly { sessionId?: string; visitorId?: string }[];
      };
      expect(payload.events[0]?.sessionId).toEqual(expect.any(String));
      expect(payload.events[0]?.visitorId).toBeUndefined();
    } finally {
      if (localDescriptor) Object.defineProperty(window, 'localStorage', localDescriptor);
      if (beaconDescriptor) Object.defineProperty(navigator, 'sendBeacon', beaconDescriptor);
      else delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    }
  });

  it('removes persisted visitor state when analytics is globally disabled', () => {
    window.localStorage.setItem(
      'niro.analytics.visitor.v1',
      JSON.stringify({
        id: 'opaque_0000000000000001',
        expiresAt: Date.now() + 86_400_000,
        consentVersion: 'privacy-v1',
      }),
    );
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/api/v1');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS', '90');
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION', 'privacy-v1');

    render(
      <AnalyticsProvider>
        <p>Analytics disabled</p>
      </AnalyticsProvider>,
    );

    expect(window.localStorage.getItem('niro.analytics.visitor.v1')).toBeNull();
  });

  it('survives Strict Effects replay and emits one normalized page view', async () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test/api/v1');
    const sent: Blob[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon');
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn((_url: string, body: Blob) => {
        sent.push(body);
        return true;
      }),
    });
    try {
      const view = render(
        <StrictMode>
          <AnalyticsProvider>
            <p>Strict calculator child</p>
          </AnalyticsProvider>
        </StrictMode>,
      );
      await waitFor(() => expect(sent).toHaveLength(1));
      view.unmount();
      const payload = JSON.parse(await sent[0]!.text()) as {
        events: readonly { type: string; props: { path?: string } }[];
      };
      expect(payload.events).toEqual([
        expect.objectContaining({
          type: 'page_view',
          props: expect.objectContaining({ path: '/' }),
        }),
      ]);
    } finally {
      if (original) Object.defineProperty(navigator, 'sendBeacon', original);
      else delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    }
  });
});
