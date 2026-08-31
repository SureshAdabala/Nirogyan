import { type HydratedDocument } from 'mongoose';
export interface JobRunDocument {
    job: string;
    scheduledFor: Date;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    attempt: number;
    startedAt?: Date;
    finishedAt?: Date;
    leaseExpiresAt?: Date;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export type JobRunModelDocument = HydratedDocument<JobRunDocument>;
export declare const JobRunModel: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<JobRunDocument, {}, {}, {}, import("mongoose").Document<unknown, {}, JobRunDocument, {}, {}> & JobRunDocument & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;
//# sourceMappingURL=job-run.d.ts.map