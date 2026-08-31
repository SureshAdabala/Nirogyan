import { model, models, Schema, Types, type HydratedDocument, type Model } from 'mongoose';

export interface AdminSessionDocument {
  adminUserId: Types.ObjectId;
  tokenFamilyId: string;
  refreshTokenHash: string;
  csrfTokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  reuseDetectedAt?: Date;
  ipHash?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSessionSchema = new Schema<AdminSessionDocument>(
  {
    adminUserId: { type: Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    tokenFamilyId: { type: String, required: true },
    refreshTokenHash: { type: String, required: true, select: false },
    csrfTokenHash: { type: String, required: true, select: false },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    reuseDetectedAt: { type: Date },
    ipHash: { type: String },
    userAgent: { type: String },
  },
  { collection: 'admin_sessions', timestamps: true },
);

AdminSessionSchema.index({ tokenFamilyId: 1 }, { unique: true });
AdminSessionSchema.index({ adminUserId: 1, expiresAt: 1 });
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AdminSessionModelDocument = HydratedDocument<AdminSessionDocument>;
export const AdminSessionModel: Model<AdminSessionDocument> =
  (models.AdminSession as Model<AdminSessionDocument> | undefined) ??
  model<AdminSessionDocument>('AdminSession', AdminSessionSchema);
