import { model, models, Schema, type HydratedDocument, type Model } from 'mongoose';

export interface AnonymousVisitorDocument {
  visitorIdHash: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  consentVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnonymousVisitorSchema = new Schema<AnonymousVisitorDocument>(
  {
    visitorIdHash: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consentVersion: { type: String },
  },
  { collection: 'anonymous_visitors', timestamps: true },
);

AnonymousVisitorSchema.index({ visitorIdHash: 1 }, { unique: true });
AnonymousVisitorSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AnonymousVisitorModelDocument = HydratedDocument<AnonymousVisitorDocument>;
export const AnonymousVisitorModel: Model<AnonymousVisitorDocument> =
  (models.AnonymousVisitor as Model<AnonymousVisitorDocument> | undefined) ??
  model<AnonymousVisitorDocument>('AnonymousVisitor', AnonymousVisitorSchema);
