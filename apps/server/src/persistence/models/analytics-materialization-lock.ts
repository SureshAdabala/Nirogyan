import { model, models, Schema, type Model } from 'mongoose';

export interface AnalyticsMaterializationLockDocument {
  _id: string;
  leaseOwner: string;
  leaseExpiresAt: Date;
  heartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsMaterializationLockSchema = new Schema<AnalyticsMaterializationLockDocument>(
  {
    _id: { type: String, required: true },
    leaseOwner: { type: String, required: true },
    leaseExpiresAt: { type: Date, required: true },
    heartbeatAt: { type: Date, required: true },
  },
  { collection: 'analytics_materialization_locks', timestamps: true },
);

AnalyticsMaterializationLockSchema.index({ leaseExpiresAt: 1 });

export const AnalyticsMaterializationLockModel: Model<AnalyticsMaterializationLockDocument> =
  (models.AnalyticsMaterializationLock as
    Model<AnalyticsMaterializationLockDocument> | undefined) ??
  model<AnalyticsMaterializationLockDocument>(
    'AnalyticsMaterializationLock',
    AnalyticsMaterializationLockSchema,
  );
