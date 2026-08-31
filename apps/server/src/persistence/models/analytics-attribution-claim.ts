import { model, models, Schema, type Model } from 'mongoose';

/**
 * Privacy-minimized, short-lived evidence that a pseudonymous inactivity
 * session has already retained attribution. The HMAC evidence is the Mongo
 * `_id`, so first-writer-wins remains atomic across processes without storing
 * a raw session identifier or any referrer/UTM value.
 */
export interface AnalyticsAttributionClaimDocument {
  _id: string;
  claimedAt: Date;
  expiresAt: Date;
}

const AnalyticsAttributionClaimSchema = new Schema<AnalyticsAttributionClaimDocument>(
  {
    _id: { type: String, required: true },
    claimedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'analytics_attribution_claims', versionKey: false },
);

AnalyticsAttributionClaimSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'analytics_attribution_claim_expiry_v1' },
);

export const AnalyticsAttributionClaimModel: Model<AnalyticsAttributionClaimDocument> =
  (models.AnalyticsAttributionClaim as Model<AnalyticsAttributionClaimDocument> | undefined) ??
  model<AnalyticsAttributionClaimDocument>(
    'AnalyticsAttributionClaim',
    AnalyticsAttributionClaimSchema,
  );

export async function ensureAnalyticsAttributionClaimIndexes(): Promise<void> {
  await AnalyticsAttributionClaimModel.collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'analytics_attribution_claim_expiry_v1' },
  );
}
