"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRunModel = void 0;
const mongoose_1 = require("mongoose");
const JobRunSchema = new mongoose_1.Schema({
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
    errorCode: { type: String },
    errorMessage: { type: String },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { collection: 'job_runs', timestamps: true, optimisticConcurrency: true });
JobRunSchema.index({ job: 1, scheduledFor: 1 }, { unique: true });
JobRunSchema.index({ status: 1, startedAt: -1 });
JobRunSchema.index({ leaseExpiresAt: 1 });
exports.JobRunModel = mongoose_1.models.JobRun ?? (0, mongoose_1.model)('JobRun', JobRunSchema);
//# sourceMappingURL=job-run.js.map