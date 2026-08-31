import { model, models, Schema, type Model } from 'mongoose';

export const ADMIN_ROLES = ['admin', 'editor', 'medical-reviewer'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminUserDocument {
  email: string;
  passwordHash: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  failedLoginCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema<AdminUserDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, required: true, default: 'editor' },
    status: { type: String, enum: ['active', 'disabled'], required: true, default: 'active' },
    failedLoginCount: { type: Number, required: true, default: 0, min: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
  },
  { collection: 'admin_users', timestamps: true },
);
AdminUserSchema.index({ email: 1 }, { unique: true });
AdminUserSchema.index({ status: 1, role: 1 });

export const AdminUserModel: Model<AdminUserDocument> =
  (models.AdminUser as Model<AdminUserDocument> | undefined) ??
  model<AdminUserDocument>('AdminUser', AdminUserSchema);
