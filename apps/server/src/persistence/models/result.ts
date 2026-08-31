import { model, models, Schema, Types, type Model } from 'mongoose';

export interface ResultDocument {
  assessmentId: Types.ObjectId;
  calculatorVersionId?: Types.ObjectId;
  calculatorSlug: string;
  calculatorVersion: number;
  engineSemanticVersion: string;
  score?: number;
  computeMs?: number;
  category?: Record<string, unknown>;
  projection: Record<string, unknown>;
  trace?: unknown[];
  shareTokenHash?: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResultSchema = new Schema<ResultDocument>(
  {
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    calculatorVersionId: { type: Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    calculatorSlug: { type: String, required: true },
    calculatorVersion: { type: Number, required: true, min: 1 },
    engineSemanticVersion: { type: String, required: true },
    score: { type: Number },
    computeMs: { type: Number, min: 0 },
    category: { type: Schema.Types.Mixed },
    projection: { type: Schema.Types.Mixed, required: true },
    trace: { type: Schema.Types.Mixed },
    shareTokenHash: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { collection: 'results', timestamps: true },
);
ResultSchema.index({ assessmentId: 1 }, { unique: true });
ResultSchema.index({ calculatorSlug: 1, createdAt: -1 });
ResultSchema.index({ calculatorVersionId: 1, createdAt: -1 });
ResultSchema.index({ createdAt: 1, expiresAt: 1, calculatorSlug: 1 });
ResultSchema.index({ shareTokenHash: 1 }, { unique: true, sparse: true });
ResultSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ResultModel: Model<ResultDocument> =
  (models.Result as Model<ResultDocument> | undefined) ??
  model<ResultDocument>('Result', ResultSchema);
