import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from '@niro/contracts/analytics-api';

export { ANALYTICS_EVENT_TYPES };
export type { AnalyticsEventType };

export interface AnalyticsEventProps {
  readonly path?: string;
  readonly calculatorSlug?: string;
  readonly step?: string;
  readonly stepIndex?: number;
  readonly query?: string;
  readonly zeroResults?: boolean;
  readonly unit?: string;
  readonly parameterKey?: string;
  readonly action?: 'open' | 'copy' | 'retake';
  readonly referrerHost?: string;
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
}

interface StorageLike {
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
  readonly removeItem: (key: string) => void;
}

interface IdentityRecord {
  readonly id: string;
  readonly lastSeenAt?: number;
  readonly expiresAt?: number;
  readonly consentVersion?: string;
  readonly attributionSent?: boolean;
}

interface IdentityReadResult {
  readonly available: boolean;
  readonly record?: IdentityRecord;
}

interface QueuedAnalyticsEvent {
  readonly eventId: string;
  readonly type: AnalyticsEventType;
  readonly occurredAt: string;
  readonly visitorId?: string;
  readonly sessionId: string;
  readonly props: AnalyticsEventProps;
}

export interface AnalyticsClient {
  readonly enabled: boolean;
  readonly track: (type: AnalyticsEventType, props?: AnalyticsEventProps) => void;
  readonly flush: () => Promise<boolean>;
  readonly dispose: () => void;
}

export interface AnalyticsClientOptions {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly persistentVisitor: boolean;
  readonly localStorage?: StorageLike;
  readonly sessionStorage?: StorageLike;
  readonly now?: () => number;
  readonly randomId?: () => string;
  readonly sendBeacon?: (url: string, data: Blob) => boolean;
  readonly fetcher?: typeof fetch;
  readonly setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  readonly sessionTimeoutMs?: number;
  readonly visitorRetentionDays?: number;
  readonly visitorConsentVersion?: string;
  readonly flushDelayMs?: number;
  readonly sessionContext?: () => AnalyticsEventProps;
}

const SESSION_KEY = 'niro.analytics.session.v1';
const VISITOR_KEY = 'niro.analytics.visitor.v1';
const MAX_BATCH_SIZE = 50;
const AUTO_FLUSH_SIZE = 10;

function bounded(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= max ? normalized : undefined;
}

function safePath(value: unknown): string | undefined {
  const path = bounded(value, 300);
  if (
    !path?.startsWith('/') ||
    path.includes('?') ||
    path.includes('#') ||
    /@|\b\d{8,}\b/.test(path)
  ) {
    return undefined;
  }
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
  const redacted = normalized.replace(/^(\/(?:api\/v1\/)?results\/)[^/]+$/i, '$1[capability]');
  return /^(?:\/$|\/c\/[a-z0-9]+(?:-[a-z0-9]+)*$|\/results\/\[capability\]$|\/api\/v1\/results\/\[capability\]$|\/biomarkers(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$)/.test(
    redacted,
  )
    ? redacted
    : undefined;
}

function safeQuery(value: unknown): string | undefined {
  const query = bounded(value, 80)?.replace(/\s+/g, ' ');
  if (!query) return undefined;
  // Search telemetry is useful, but obvious contact details and long numeric
  // identifiers must never become analytics dimensions.
  if (/[@]/.test(query) || /\b\+?\d[\d\s()-]{7,}\b/.test(query)) return '[redacted]';
  return query;
}

function safeDimension(value: unknown, max = 100): string | undefined {
  const dimension = bounded(value, max);
  if (!dimension || /[@]/.test(dimension) || /\b\+?\d[\d\s()-]{7,}\b/.test(dimension)) {
    return undefined;
  }
  return /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/.test(dimension) ? dimension : undefined;
}

function safeIdentifier(value: unknown, max = 100): string | undefined {
  const identifier = bounded(value, max);
  return identifier && /^[A-Za-z0-9][A-Za-z0-9._:~-]*$/.test(identifier) ? identifier : undefined;
}

function safeSlug(value: unknown): string | undefined {
  const slug = bounded(value, 100);
  return slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : undefined;
}

function safeHost(value: unknown): string | undefined {
  const host = bounded(value, 253)?.toLowerCase();
  if (!host || host.includes(':') || /^\d+$/.test(host) || /^\d+(?:\.\d+){3}$/.test(host)) {
    return undefined;
  }
  try {
    const normalized = new URL(`http://${host}`).hostname;
    if (normalized.startsWith('[') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return host &&
    /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/.test(host)
    ? host
    : undefined;
}

function safeUnit(value: unknown): string | undefined {
  const unit = bounded(value, 30);
  return unit && /^[A-Za-z0-9µμ%/^.\s-]+$/u.test(unit) ? unit : undefined;
}

function safeOpaqueIdentity(value: unknown): string | undefined {
  const identity = bounded(value, 200);
  return identity && identity.length >= 16 && /^[A-Za-z0-9_-]+$/.test(identity)
    ? identity
    : undefined;
}

function sanitizeProps(props: AnalyticsEventProps | undefined): AnalyticsEventProps {
  if (!props) return {};
  const path = safePath(props.path);
  const calculatorSlug = safeSlug(props.calculatorSlug);
  const step = safeIdentifier(props.step);
  const stepIndex =
    Number.isSafeInteger(props.stepIndex) &&
    Number(props.stepIndex) >= 0 &&
    Number(props.stepIndex) <= 100
      ? Number(props.stepIndex)
      : undefined;
  const query = safeQuery(props.query);
  const unit = safeUnit(props.unit);
  const parameterKey = safeIdentifier(props.parameterKey);
  const action = ['open', 'copy', 'retake'].includes(props.action ?? '') ? props.action : undefined;
  const referrerHost = safeHost(props.referrerHost);
  const utmSource = safeDimension(props.utmSource);
  const utmMedium = safeDimension(props.utmMedium);
  const utmCampaign = safeDimension(props.utmCampaign);
  return {
    ...(path ? { path } : {}),
    ...(calculatorSlug ? { calculatorSlug } : {}),
    ...(step ? { step } : {}),
    ...(stepIndex !== undefined ? { stepIndex } : {}),
    ...(query ? { query } : {}),
    ...(typeof props.zeroResults === 'boolean' ? { zeroResults: props.zeroResults } : {}),
    ...(unit ? { unit } : {}),
    ...(parameterKey ? { parameterKey } : {}),
    ...(action ? { action } : {}),
    ...(referrerHost ? { referrerHost } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
  };
}

const EVENT_PROP_RULES: Readonly<
  Record<
    AnalyticsEventType,
    { readonly required: readonly string[]; readonly allowed: readonly string[] }
  >
> = {
  page_view: {
    required: ['path'],
    allowed: ['path', 'calculatorSlug', 'referrerHost', 'utmSource', 'utmMedium', 'utmCampaign'],
  },
  calc_start: {
    required: ['calculatorSlug'],
    allowed: ['calculatorSlug', 'path', 'referrerHost', 'utmSource', 'utmMedium', 'utmCampaign'],
  },
  step_view: {
    required: ['calculatorSlug', 'step', 'stepIndex'],
    allowed: ['calculatorSlug', 'step', 'stepIndex'],
  },
  assess_submit: { required: ['calculatorSlug'], allowed: ['calculatorSlug'] },
  result_view: { required: ['calculatorSlug'], allowed: ['calculatorSlug', 'path'] },
  share: { required: ['calculatorSlug', 'action'], allowed: ['calculatorSlug', 'action'] },
  search: { required: ['query', 'zeroResults'], allowed: ['query', 'zeroResults', 'path'] },
  unit_switch: {
    required: ['calculatorSlug', 'parameterKey', 'unit'],
    allowed: ['calculatorSlug', 'parameterKey', 'unit'],
  },
  share_open: {
    required: ['calculatorSlug', 'path', 'action'],
    allowed: ['calculatorSlug', 'path', 'action'],
  },
  retake: { required: ['calculatorSlug', 'action'], allowed: ['calculatorSlug', 'action'] },
  assess_error: { required: ['calculatorSlug'], allowed: ['calculatorSlug', 'step'] },
};

function semanticPropsValid(type: AnalyticsEventType, props: AnalyticsEventProps): boolean {
  const rule = EVENT_PROP_RULES[type];
  const keys = Object.keys(props);
  if (rule.required.some((key) => !(key in props))) return false;
  if (keys.some((key) => !rule.allowed.includes(key))) return false;
  if (type === 'share') return props.action === 'copy';
  if (type === 'share_open') return props.action === 'open';
  if (type === 'retake') return props.action === 'retake';
  return true;
}

function readIdentity(storage: StorageLike | undefined, key: string): IdentityReadResult {
  if (!storage) return { available: false };
  try {
    const stored = storage.getItem(key);
    if (stored === null) return { available: true };
    const parsed = JSON.parse(stored) as Partial<IdentityRecord>;
    const id = safeOpaqueIdentity(parsed.id);
    return {
      available: true,
      record: id
        ? {
            id,
            lastSeenAt: typeof parsed.lastSeenAt === 'number' ? parsed.lastSeenAt : undefined,
            expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : undefined,
            consentVersion: bounded(parsed.consentVersion, 100),
            attributionSent:
              typeof parsed.attributionSent === 'boolean' ? parsed.attributionSent : undefined,
          }
        : undefined,
    };
  } catch {
    return { available: false };
  }
}

function writeIdentity(
  storage: StorageLike | undefined,
  key: string,
  value: IdentityRecord,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Analytics remains optional when browser storage is unavailable.
    return false;
  }
}

function defaultRandomId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Secure browser randomness is unavailable.');
  }
  return crypto.randomUUID();
}

export function analyticsEndpoint(apiBase: string | undefined): string | undefined {
  const value = apiBase?.trim();
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    return `${parsed.toString().replace(/\/$/, '')}/events`;
  } catch {
    return undefined;
  }
}

export function createAnalyticsClient(options: AnalyticsClientOptions): AnalyticsClient {
  const now = options.now ?? Date.now;
  const randomId = options.randomId ?? defaultRandomId;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const sessionTimeoutMs = options.sessionTimeoutMs ?? 30 * 60 * 1000;
  const configuredVisitorRetention = options.visitorRetentionDays;
  const visitorRetentionDays =
    typeof configuredVisitorRetention === 'number' &&
    Number.isSafeInteger(configuredVisitorRetention) &&
    configuredVisitorRetention > 0
      ? configuredVisitorRetention
      : undefined;
  const visitorRetentionMs = (visitorRetentionDays ?? 0) * 86_400_000;
  const flushDelayMs = options.flushDelayMs ?? 1_000;
  const queue: QueuedAnalyticsEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let retryAttempt = 0;
  let memorySession: IdentityRecord | undefined;

  const consentVersion = bounded(options.visitorConsentVersion, 100);
  const persistentVisitorEnabled =
    options.persistentVisitor &&
    options.localStorage !== undefined &&
    visitorRetentionDays !== undefined &&
    consentVersion !== undefined &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(consentVersion);
  if (!persistentVisitorEnabled) {
    try {
      options.localStorage?.removeItem(VISITOR_KEY);
    } catch {
      // Revocation cleanup is best-effort when browser storage is denied.
    }
  }

  function sessionIdentity(
    at: number,
    attributionEligible: boolean,
  ):
    | {
        readonly id: string;
        readonly attachAttribution: boolean;
        readonly record: IdentityRecord;
      }
    | undefined {
    const stored = readIdentity(options.sessionStorage, SESSION_KEY).record;
    const current =
      memorySession &&
      (!stored || (memorySession.lastSeenAt ?? -Infinity) >= (stored.lastSeenAt ?? -Infinity))
        ? memorySession
        : stored;
    const active = current?.lastSeenAt !== undefined && at - current.lastSeenAt <= sessionTimeoutMs;
    let id: string;
    try {
      id = active ? current.id : safeOpaqueIdentity(randomId())!;
      if (!id) return undefined;
    } catch {
      return undefined;
    }
    const attachAttribution = attributionEligible && (!active || current.attributionSent !== true);
    return {
      id,
      attachAttribution,
      record: {
        id,
        lastSeenAt: at,
        attributionSent: (active && current?.attributionSent === true) || attachAttribution,
      },
    };
  }

  function commitSession(session: { readonly record: IdentityRecord }): void {
    memorySession = session.record;
    writeIdentity(options.sessionStorage, SESSION_KEY, session.record);
  }

  function visitorId(at: number): string | undefined {
    if (!persistentVisitorEnabled || !consentVersion || !visitorRetentionDays) return undefined;
    const read = readIdentity(options.localStorage, VISITOR_KEY);
    if (!read.available) return undefined;
    const current = read.record;
    if (
      current?.expiresAt !== undefined &&
      current.expiresAt > at &&
      current.consentVersion === consentVersion
    ) {
      const updated = {
        id: current.id,
        expiresAt: at + visitorRetentionMs,
        consentVersion,
      };
      return writeIdentity(options.localStorage, VISITOR_KEY, updated) ? current.id : undefined;
    }
    try {
      const id = safeOpaqueIdentity(randomId());
      if (!id) return undefined;
      const created = { id, expiresAt: at + visitorRetentionMs, consentVersion };
      return writeIdentity(options.localStorage, VISITOR_KEY, created) ? created.id : undefined;
    } catch {
      return undefined;
    }
  }

  async function flush(): Promise<boolean> {
    if (timer !== undefined) {
      clearTimer(timer);
      timer = undefined;
    }
    if (!options.enabled || queue.length === 0) return true;
    const events = queue.splice(0, MAX_BATCH_SIZE);
    const payload = JSON.stringify({ events });
    try {
      if (options.sendBeacon) {
        const accepted = options.sendBeacon(
          options.endpoint,
          new Blob([payload], { type: 'application/json' }),
        );
        if (accepted) {
          retryAttempt = 0;
          return true;
        }
      }
      if (!options.fetcher) throw new Error('No analytics transport is available.');
      const response = await options.fetcher(options.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
        credentials: 'omit',
      });
      if (!response.ok) throw new Error(`Analytics endpoint returned ${response.status}.`);
      retryAttempt = 0;
      return true;
    } catch {
      // Keep only the most recent bounded batch for one later retry. Telemetry
      // must never interfere with the calculator experience.
      queue.unshift(...events);
      if (queue.length > MAX_BATCH_SIZE) queue.splice(0, queue.length - MAX_BATCH_SIZE);
      if (!disposed && retryAttempt < 3) {
        retryAttempt += 1;
        scheduleFlush(flushDelayMs * 2 ** retryAttempt);
      }
      return false;
    }
  }

  function scheduleFlush(delay = flushDelayMs): void {
    if (timer !== undefined) return;
    timer = setTimer(() => {
      timer = undefined;
      void flush();
    }, delay);
  }

  function track(type: AnalyticsEventType, props?: AnalyticsEventProps): void {
    if (!options.enabled || disposed || !ANALYTICS_EVENT_TYPES.includes(type)) return;
    const at = now();
    const session = sessionIdentity(at, type === 'page_view' || type === 'calc_start');
    if (!session) return;
    let eventId: string;
    try {
      eventId = randomId();
    } catch {
      return;
    }
    let sessionProps = props;
    if (session.attachAttribution && options.sessionContext) {
      try {
        sessionProps = { ...options.sessionContext(), ...props };
      } catch {
        sessionProps = props;
      }
    }
    const sanitized = sanitizeProps(sessionProps);
    if (!session.attachAttribution) {
      delete (sanitized as { referrerHost?: string }).referrerHost;
      delete (sanitized as { utmSource?: string }).utmSource;
      delete (sanitized as { utmMedium?: string }).utmMedium;
      delete (sanitized as { utmCampaign?: string }).utmCampaign;
    }
    if (!semanticPropsValid(type, sanitized)) return;
    queue.push({
      eventId,
      type,
      occurredAt: new Date(at).toISOString(),
      visitorId: visitorId(at),
      sessionId: session.id,
      props: sanitized,
    });
    commitSession(session);
    if (queue.length >= AUTO_FLUSH_SIZE) void flush();
    else scheduleFlush();
  }

  return {
    enabled: options.enabled,
    track,
    flush,
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
    },
  };
}
