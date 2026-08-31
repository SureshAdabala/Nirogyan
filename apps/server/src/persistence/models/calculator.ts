import { model, models, Schema, Types, type HydratedDocument, type Model } from 'mongoose';

import { LIFECYCLE_STATUSES, type LifecycleStatus } from '../types';

export interface CalculatorDocument {
  slug: string;
  name: string;
  status: LifecycleStatus;
  currentVersionId?: Types.ObjectId;
  draftVersionId?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CalculatorSchema = new Schema<CalculatorDocument>(
  {
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: LIFECYCLE_STATUSES, required: true, default: 'draft' },
    currentVersionId: { type: Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    draftVersionId: { type: Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  },
  { collection: 'calculators', timestamps: true },
);

CalculatorSchema.index({ slug: 1 }, { unique: true });
CalculatorSchema.index({ status: 1, updatedAt: -1 });

export type CalculatorModelDocument = HydratedDocument<CalculatorDocument>;
export const CalculatorModel: Model<CalculatorDocument> =
  (models.Calculator as Model<CalculatorDocument> | undefined) ??
  model<CalculatorDocument>('Calculator', CalculatorSchema);
