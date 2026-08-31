import { model, models, Schema, Types, type Model } from 'mongoose';

export interface AuditLogDocument {
  actorId?: Types.ObjectId;
  action: string;
  entityType: string;
  entityId?: string;
  diffSummary?: Record<string, unknown>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    diffSummary: { type: Schema.Types.Mixed },
  },
  { collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } },
);
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export const AuditLogModel: Model<AuditLogDocument> =
  (models.AuditLog as Model<AuditLogDocument> | undefined) ??
  model<AuditLogDocument>('AuditLog', AuditLogSchema);
