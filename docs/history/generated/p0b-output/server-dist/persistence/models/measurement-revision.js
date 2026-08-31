"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeasurementRevisionModel = void 0;
const mongoose_1 = require("mongoose");
const MeasurementRevisionSchema = new mongoose_1.Schema({
    key: { type: String, required: true, trim: true },
    revision: { type: Number, required: true, min: 1 },
    status: {
        type: String,
        enum: ['draft', 'verified', 'retired'],
        required: true,
        default: 'draft',
    },
    displayName: { type: String, required: true, trim: true },
    kind: {
        type: String,
        enum: ['biomarker', 'demographic', 'lifestyle', 'derived'],
        required: true,
    },
    canonicalUnit: { type: String },
    definition: { type: mongoose_1.Schema.Types.Mixed, required: true },
    definitionHash: { type: String, required: true },
    sources: { type: mongoose_1.Schema.Types.Mixed, required: true, default: [] },
}, { collection: 'biomarkers', timestamps: true, optimisticConcurrency: true });
MeasurementRevisionSchema.index({ key: 1, revision: 1 }, { unique: true });
MeasurementRevisionSchema.index({ key: 1, status: 1 });
MeasurementRevisionSchema.index({ displayName: 'text', key: 'text' });
exports.MeasurementRevisionModel = mongoose_1.models.MeasurementRevision ??
    (0, mongoose_1.model)('MeasurementRevision', MeasurementRevisionSchema);
//# sourceMappingURL=measurement-revision.js.map