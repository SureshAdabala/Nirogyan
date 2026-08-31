import { createHmac } from 'node:crypto';

import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from '@niro/contracts';
import { model, models, Schema, type Model } from 'mongoose';

export { ANALYTICS_EVENT_TYPES, type AnalyticsEventType };

export interface AnalyticsEventDocument {
  /** Domain-separated HMAC evidence; the client-supplied event ID is never stored. */
  eventId: string;
  eventIdHashVersion?: 'hmac-v1';
  type: AnalyticsEventType;
  occurredAt: Date;
  visitorIdHash?: string;
  sessionIdHash: string;
  identityKeyVersion: string;
  calculatorSlug?: string;
  path?: string;
  step?: string;
  stepIndex?: number;
  query?: string;
  device?: string;
  browser?: string;
  os?: string;
  locale?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  zeroResults?: boolean;
  unit?: string;
  parameterKey?: string;
  action?: 'open' | 'copy' | 'retake';
  expiresAt: Date;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<AnalyticsEventDocument>(
  {
    eventId: { type: String, required: true },
    eventIdHashVersion: { type: String, enum: ['hmac-v1'] },
    type: { type: String, enum: ANALYTICS_EVENT_TYPES, required: true },
    occurredAt: { type: Date, required: true },
    visitorIdHash: { type: String },
    sessionIdHash: { type: String, required: true },
    identityKeyVersion: { type: String, required: true },
    calculatorSlug: { type: String },
    path: { type: String },
    step: { type: String },
    stepIndex: { type: Number, min: 0, max: 100, validate: Number.isSafeInteger },
    query: { type: String },
    device: { type: String },
    browser: { type: String },
    os: { type: String },
    locale: { type: String },
    referrerHost: { type: String },
    utmSource: { type: String },
    utmMedium: { type: String },
    utmCampaign: { type: String },
    zeroResults: { type: Boolean },
    unit: { type: String },
    parameterKey: { type: String },
    action: { type: String, enum: ['open', 'copy', 'retake'] },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'analytics_events', timestamps: { createdAt: true, updatedAt: false } },
);

AnalyticsEventSchema.index({ eventId: 1 }, { unique: true });
AnalyticsEventSchema.index({ occurredAt: -1, type: 1 });
AnalyticsEventSchema.index({ calculatorSlug: 1, occurredAt: -1 });
AnalyticsEventSchema.index({ sessionIdHash: 1, occurredAt: 1 });
AnalyticsEventSchema.index({ visitorIdHash: 1, occurredAt: 1 });
AnalyticsEventSchema.index({ identityKeyVersion: 1, occurredAt: 1, expiresAt: 1 });
AnalyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AnalyticsEventModel: Model<AnalyticsEventDocument> =
  (models.AnalyticsEvent as Model<AnalyticsEventDocument> | undefined) ??
  model<AnalyticsEventDocument>('AnalyticsEvent', AnalyticsEventSchema);

export function analyticsEventIdEvidence(eventId: string, secret: string): string {
  return `v1:${createHmac('sha256', secret)
    .update(`analytics-event-id:v1:${eventId}`)
    .digest('hex')}`;
}

/** One-way startup migration for pre-P9 raw event IDs. */
export async function scrubLegacyAnalyticsEventIds(secret: string): Promise<number> {
  const cursor = AnalyticsEventModel.find({ eventIdHashVersion: { $ne: 'hmac-v1' } })
    .select('eventId')
    .lean()
    .cursor();
  const operations: Parameters<typeof AnalyticsEventModel.bulkWrite>[0] = [];
  let scrubbed = 0;
  async function flush(): Promise<void> {
    if (operations.length === 0) return;
    await AnalyticsEventModel.bulkWrite(operations.splice(0, operations.length), {
      ordered: false,
    });
  }
  for await (const event of cursor) {
    operations.push({
      updateOne: {
        filter: { _id: event._id, eventIdHashVersion: { $ne: 'hmac-v1' } },
        update: {
          $set: {
            eventId: analyticsEventIdEvidence(event.eventId, secret),
            eventIdHashVersion: 'hmac-v1',
          },
        },
      },
    });
    scrubbed += 1;
    if (operations.length >= 500) await flush();
  }
  await flush();
  return scrubbed;
}
