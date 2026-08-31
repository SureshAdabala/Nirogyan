import { model, models, Schema, type Model } from 'mongoose';

export interface LoginAttemptDocument {
  /** Legacy field retained only until the 90-day TTL ages out pre-P9 rows. */
  email?: string;
  accountHash?: string;
  success: boolean;
  reason?: string;
  ipHash?: string;
  createdAt: Date;
}

const LoginAttemptSchema = new Schema<LoginAttemptDocument>(
  {
    email: { type: String, lowercase: true, trim: true, select: false },
    accountHash: { type: String, select: false },
    success: { type: Boolean, required: true },
    reason: { type: String },
    ipHash: { type: String },
  },
  { collection: 'login_attempts', timestamps: { createdAt: true, updatedAt: false } },
);
LoginAttemptSchema.index({ email: 1, createdAt: -1 });
LoginAttemptSchema.index({ accountHash: 1, createdAt: -1 });
LoginAttemptSchema.index({ createdAt: -1, success: 1 });
LoginAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const LoginAttemptModel: Model<LoginAttemptDocument> =
  (models.LoginAttempt as Model<LoginAttemptDocument> | undefined) ??
  model<LoginAttemptDocument>('LoginAttempt', LoginAttemptSchema);
