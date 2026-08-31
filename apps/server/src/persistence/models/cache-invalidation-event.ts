import { model, models, Schema, Types, type Model } from 'mongoose';

export interface CacheInvalidationEventDocument {
  calculatorSlug: string;
  calculatorVersionId?: Types.ObjectId;
  reason: 'publish' | 'retire';
  paths: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  nextRetryAt?: Date;
  completedAt?: Date;
  lastError?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CacheInvalidationEventSchema = new Schema<CacheInvalidationEventDocument>(
  {
    calculatorSlug: { type: String, required: true, trim: true },
    calculatorVersionId: { type: Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    reason: { type: String, enum: ['publish', 'retire'], required: true },
    paths: { type: [String], required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      required: true,
      default: 'pending',
    },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    leaseOwner: { type: String },
    leaseExpiresAt: { type: Date },
    nextRetryAt: { type: Date },
    completedAt: { type: Date },
    lastError: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'cache_invalidation_events', timestamps: true },
);

CacheInvalidationEventSchema.index({ status: 1, createdAt: 1 });
CacheInvalidationEventSchema.index({ status: 1, nextRetryAt: 1, leaseExpiresAt: 1, createdAt: 1 });
CacheInvalidationEventSchema.index({ calculatorSlug: 1, createdAt: -1 });
CacheInvalidationEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CacheInvalidationEventModel: Model<CacheInvalidationEventDocument> =
  (models.CacheInvalidationEvent as Model<CacheInvalidationEventDocument> | undefined) ??
  model<CacheInvalidationEventDocument>('CacheInvalidationEvent', CacheInvalidationEventSchema);
