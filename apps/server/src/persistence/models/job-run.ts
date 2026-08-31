import { model, models, Schema, type HydratedDocument, type Model } from 'mongoose';

export interface JobRunDocument {
  job: string;
  scheduledFor: Date;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempt: number;
  startedAt?: Date;
  finishedAt?: Date;
  leaseExpiresAt?: Date;
  leaseOwner?: string;
  heartbeatAt?: Date;
  nextRetryAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const JobRunSchema = new Schema<JobRunDocument>(
  {
    job: { type: String, required: true, trim: true },
    scheduledFor: { type: Date, required: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
      required: true,
      default: 'queued',
    },
    attempt: { type: Number, required: true, min: 0, default: 0 },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    leaseExpiresAt: { type: Date },
    leaseOwner: { type: String },
    heartbeatAt: { type: Date },
    nextRetryAt: { type: Date },
    errorCode: { type: String },
    errorMessage: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { collection: 'job_runs', timestamps: true, optimisticConcurrency: true },
);

JobRunSchema.index({ job: 1, scheduledFor: 1 }, { unique: true });
JobRunSchema.index({ status: 1, startedAt: -1 });
JobRunSchema.index({ leaseExpiresAt: 1 });
JobRunSchema.index({ status: 1, nextRetryAt: 1 });
JobRunSchema.index({ scheduledFor: -1 });

export type JobRunModelDocument = HydratedDocument<JobRunDocument>;
export const JobRunModel: Model<JobRunDocument> =
  (models.JobRun as Model<JobRunDocument> | undefined) ??
  model<JobRunDocument>('JobRun', JobRunSchema);
