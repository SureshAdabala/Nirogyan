import { model, models, Schema, Types, type Model } from 'mongoose';

export interface AssessmentDocument {
  calculatorSlug: string;
  calculatorVersionId?: Types.ObjectId;
  calculatorVersion: number;
  engineSemanticVersion: string;
  inputsEntered: Record<string, unknown>;
  inputsCanonical: Record<string, unknown>;
  conversionHash?: string;
  visitorId?: string;
  sessionId?: string;
  omittedParameters: string[];
  /** A one-way, endpoint-scoped replay key; the raw client key is never persisted. */
  idempotencyKeyHash?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<AssessmentDocument>(
  {
    calculatorSlug: { type: String, required: true, index: true },
    calculatorVersionId: { type: Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    calculatorVersion: { type: Number, required: true, min: 1 },
    engineSemanticVersion: { type: String, required: true },
    inputsEntered: { type: Schema.Types.Mixed, required: true },
    inputsCanonical: { type: Schema.Types.Mixed, required: true },
    conversionHash: { type: String },
    visitorId: { type: String, index: true },
    sessionId: { type: String, index: true },
    omittedParameters: { type: [String], default: [] },
    idempotencyKeyHash: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'assessments', timestamps: true },
);
AssessmentSchema.index({ calculatorSlug: 1, createdAt: -1 });
AssessmentSchema.index({ calculatorVersionId: 1, createdAt: -1 });
AssessmentSchema.index({ createdAt: 1, expiresAt: 1, calculatorSlug: 1 });
AssessmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AssessmentSchema.index({ sessionId: 1, createdAt: -1 });
AssessmentSchema.index(
  { idempotencyKeyHash: 1 },
  { unique: true, sparse: true, name: 'assessment_idempotency_key_hash_unique' },
);

export const AssessmentModel: Model<AssessmentDocument> =
  (models.Assessment as Model<AssessmentDocument> | undefined) ??
  model<AssessmentDocument>('Assessment', AssessmentSchema);
