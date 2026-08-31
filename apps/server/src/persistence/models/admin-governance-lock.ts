import { model, models, Schema, type Model } from 'mongoose';

/**
 * A single transaction lock used to serialize changes that could remove an
 * active administrator. It prevents concurrent demotions from both observing
 * a stale active-admin count and violating the last-admin invariant.
 */
export interface AdminGovernanceLockDocument {
  _id: string;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

const AdminGovernanceLockSchema = new Schema<AdminGovernanceLockDocument>(
  {
    _id: { type: String, required: true },
    revision: { type: Number, required: true, default: 0 },
  },
  { collection: 'admin_governance_locks', timestamps: true },
);

export const AdminGovernanceLockModel: Model<AdminGovernanceLockDocument> =
  (models.AdminGovernanceLock as Model<AdminGovernanceLockDocument> | undefined) ??
  model<AdminGovernanceLockDocument>('AdminGovernanceLock', AdminGovernanceLockSchema);
