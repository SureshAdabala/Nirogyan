import type { Request, Response } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sorted[lower] ?? 0;
  const upperValue = sorted[upper] ?? lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

export class OperationalMetrics {
  readonly registry = new Registry();
  private readonly durations: number[] = [];
  private requests = 0;
  private errors = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private rateLimitTrips = 0;
  private publicRateLimitTrips = 0;
  private acceptedEvents = 0;
  private rejectedEvents = 0;
  private filteredBots = 0;
  private readonly requestCounter: Counter<'method' | 'status'>;
  private readonly requestDuration: Histogram<'method' | 'status'>;
  private readonly eventCounter: Counter<'outcome'>;

  constructor(collectProcessMetrics = false) {
    this.requestCounter = new Counter({
      name: 'niro_http_requests_total',
      help: 'HTTP requests completed by method and status.',
      labelNames: ['method', 'status'],
      registers: [this.registry],
    });
    this.requestDuration = new Histogram({
      name: 'niro_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
    this.eventCounter = new Counter({
      name: 'niro_analytics_events_total',
      help: 'Analytics events by privacy-safe ingestion outcome.',
      labelNames: ['outcome'],
      registers: [this.registry],
    });
    if (collectProcessMetrics) collectDefaultMetrics({ register: this.registry, prefix: 'niro_' });
  }

  middleware() {
    return (request: Request, response: Response, next: () => void): void => {
      const started = process.hrtime.bigint();
      response.once('finish', () => {
        const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
        this.observeRequest(request.method, request.path, response.statusCode, elapsedMs);
      });
      next();
    };
  }

  observeRequest(method: string, path: string, status: number, elapsedMs: number): void {
    this.requests += 1;
    if (status >= 400) this.errors += 1;
    if (status === 429) {
      this.rateLimitTrips += 1;
      if (!path.startsWith('/admin') && !path.startsWith('/api/v1/admin')) {
        this.publicRateLimitTrips += 1;
      }
    }
    this.durations.push(elapsedMs);
    if (this.durations.length > 5_000) this.durations.splice(0, this.durations.length - 5_000);
    const labels = { method: method.toUpperCase(), status: String(status) };
    this.requestCounter.inc(labels);
    this.requestDuration.observe(labels, elapsedMs / 1_000);
    void path;
  }

  observeCatalogCache(outcome: 'hit' | 'miss'): void {
    if (outcome === 'hit') this.cacheHits += 1;
    else this.cacheMisses += 1;
  }

  observeEvents(outcome: 'accepted' | 'rejected' | 'filtered-bot', count: number): void {
    if (outcome === 'accepted') this.acceptedEvents += count;
    if (outcome === 'rejected') this.rejectedEvents += count;
    if (outcome === 'filtered-bot') this.filteredBots += count;
    this.eventCounter.inc({ outcome }, count);
  }

  snapshot() {
    const cacheTotal = this.cacheHits + this.cacheMisses;
    return {
      requestLatencyMs: {
        p50: Number(percentile(this.durations, 0.5).toFixed(2)),
        p95: Number(percentile(this.durations, 0.95).toFixed(2)),
      },
      errorRate: this.requests ? this.errors / this.requests : 0,
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: cacheTotal ? this.cacheHits / cacheTotal : 0,
      },
      eventIngest: {
        accepted: this.acceptedEvents,
        rejected: this.rejectedEvents,
        filteredBots: this.filteredBots,
      },
      rateLimitTrips: this.rateLimitTrips,
      publicRateLimitTrips: this.publicRateLimitTrips,
    };
  }
}
