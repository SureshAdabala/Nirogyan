'use client';

import { usePathname } from 'next/navigation';
import React from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  analyticsEndpoint,
  createAnalyticsClient,
  type AnalyticsClient,
  type AnalyticsEventProps,
  type AnalyticsEventType,
} from './client';

interface AnalyticsContextValue {
  readonly enabled: boolean;
  readonly track: (type: AnalyticsEventType, props?: AnalyticsEventProps) => void;
  readonly flush: () => Promise<boolean>;
}

const disabled: AnalyticsContextValue = {
  enabled: false,
  track: () => undefined,
  flush: async () => true,
};

const AnalyticsContext = createContext<AnalyticsContextValue>(disabled);

function firstSessionContext(): AnalyticsEventProps {
  try {
    const referrer = document.referrer ? new URL(document.referrer) : undefined;
    const query = new URLSearchParams(window.location.search);
    return {
      referrerHost: analyticsReferrerHost(referrer?.toString(), window.location.origin),
      utmSource: query.get('utm_source') ?? undefined,
      utmMedium: query.get('utm_medium') ?? undefined,
      utmCampaign: query.get('utm_campaign') ?? undefined,
    };
  } catch {
    return {};
  }
}

export function analyticsReferrerHost(
  referrer: string | undefined,
  currentOrigin: string,
): string | undefined {
  if (!referrer) return undefined;
  try {
    const source = new URL(referrer);
    return source.origin === new URL(currentOrigin).origin ? undefined : source.hostname;
  } catch {
    return undefined;
  }
}

export function analyticsPageContext(pathname: string): AnalyticsEventProps {
  const calculator = /^\/c\/([^/]+)$/.exec(pathname);
  if (calculator?.[1]) {
    try {
      const calculatorSlug = decodeURIComponent(calculator[1]);
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(calculatorSlug)) {
        return { path: `/c/${calculatorSlug}`, calculatorSlug };
      }
    } catch {
      return { path: '/c/[invalid]' };
    }
  }
  if (/^\/results\/[^/]+$/.test(pathname)) return { path: '/results/[capability]' };
  return { path: pathname };
}

export function parseVisitorRetentionDays(value: string | undefined): number | undefined {
  const normalized = value?.trim();
  if (!normalized || !/^[1-9]\d*$/.test(normalized)) return undefined;
  const days = Number(normalized);
  return Number.isSafeInteger(days) ? days : undefined;
}

function browserClient(): AnalyticsClient {
  const endpoint = analyticsEndpoint(process.env.NEXT_PUBLIC_API_BASE_URL);
  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && endpoint !== undefined;
  const visitorConsentVersion = process.env.NEXT_PUBLIC_ANALYTICS_VISITOR_CONSENT_VERSION?.trim();
  const validConsentVersion =
    visitorConsentVersion !== undefined &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(visitorConsentVersion)
      ? visitorConsentVersion
      : undefined;
  const visitorRetentionDays = parseVisitorRetentionDays(
    process.env.NEXT_PUBLIC_ANALYTICS_VISITOR_RETENTION_DAYS,
  );
  let localStorage: Storage | undefined;
  let sessionStorage: Storage | undefined;
  try {
    localStorage = window.localStorage;
  } catch {
    // Browser privacy policies may deny persistent storage. Telemetry remains optional.
  }
  try {
    sessionStorage = window.sessionStorage;
  } catch {
    // The analytics client keeps one bounded in-memory session when storage is denied.
  }
  try {
    return createAnalyticsClient({
      enabled,
      endpoint: endpoint ?? 'http://127.0.0.1/disabled-analytics',
      persistentVisitor:
        enabled &&
        sessionStorage !== undefined &&
        localStorage !== undefined &&
        process.env.NEXT_PUBLIC_ANALYTICS_VISITOR_PERSISTENCE_ENABLED === 'true' &&
        Boolean(validConsentVersion) &&
        visitorRetentionDays !== undefined,
      visitorConsentVersion: validConsentVersion,
      visitorRetentionDays,
      sessionContext: firstSessionContext,
      localStorage,
      sessionStorage,
      sendBeacon:
        typeof navigator.sendBeacon === 'function'
          ? navigator.sendBeacon.bind(navigator)
          : undefined,
      fetcher: typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined,
    });
  } catch {
    return createAnalyticsClient({
      enabled: false,
      endpoint: 'http://127.0.0.1/disabled-analytics',
      persistentVisitor: false,
    });
  }
}

export function AnalyticsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [client] = useState<AnalyticsClient>(() =>
    typeof window === 'undefined'
      ? createAnalyticsClient({
          enabled: false,
          endpoint: 'http://127.0.0.1/disabled-analytics',
          persistentVisitor: false,
        })
      : browserClient(),
  );
  const lastPageView = useRef<string | undefined>(undefined);

  useEffect(() => {
    const flush = () => void client.flush();
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
      void client.flush();
    };
  }, [client]);

  useEffect(() => {
    if (!pathname.startsWith('/admin') && lastPageView.current !== pathname) {
      lastPageView.current = pathname;
      client.track('page_view', {
        ...analyticsPageContext(pathname),
      });
    }
  }, [client, pathname]);

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      enabled: client.enabled,
      track: (type, props) => client.track(type, props),
      flush: () => client.flush(),
    }),
    [client],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}
