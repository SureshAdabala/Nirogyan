import { model, models, Schema, type Model } from 'mongoose';

export interface LeadDocument {
  email: string;
  consent: true;
  consentVersion: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<LeadDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    consent: {
      type: Boolean,
      required: true,
      validate: {
        validator: (value: boolean) => value === true,
        message: 'Explicit lead consent is required.',
      },
    },
    consentVersion: { type: String, required: true, trim: true, maxlength: 100 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'leads', timestamps: true },
);

LeadSchema.index({ email: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LeadModel: Model<LeadDocument> =
  (models.Lead as Model<LeadDocument> | undefined) ?? model<LeadDocument>('Lead', LeadSchema);
