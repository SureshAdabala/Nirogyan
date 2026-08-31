"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculatorVersionModel = void 0;
const mongoose_1 = require("mongoose");
const contracts_1 = require("@niro/contracts");
const types_1 = require("../types");
const CalculatorVersionSchema = new mongoose_1.Schema({
    calculatorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Calculator', required: true },
    calculatorSlug: { type: String, required: true, trim: true },
    version: { type: Number, required: true, min: 1 },
    status: { type: String, enum: types_1.LIFECYCLE_STATUSES, required: true, default: 'draft' },
    schemaId: { type: String, required: true, default: contracts_1.CONTRACT_SCHEMA_IDS.calculatorVersion },
    engineSemanticVersion: { type: String, required: true },
    payload: { type: mongoose_1.Schema.Types.Mixed, required: true },
    measurementRevisionIds: { type: [String], required: true, default: [] },
    measurementSnapshots: { type: mongoose_1.Schema.Types.Mixed, required: true, default: [] },
    sourceHash: { type: String },
    logicHash: { type: String },
    contentHash: { type: String },
    reviewHash: { type: String },
    versionHash: { type: String },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AdminUser' },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AdminUser' },
    publishedAt: { type: Date },
    immutableAt: { type: Date },
}, { collection: 'calculator_versions', timestamps: true, optimisticConcurrency: true });
CalculatorVersionSchema.index({ calculatorId: 1, version: -1 }, { unique: true });
CalculatorVersionSchema.index({ calculatorSlug: 1, status: 1 });
CalculatorVersionSchema.index({ versionHash: 1 }, { unique: true, sparse: true });
exports.CalculatorVersionModel = mongoose_1.models.CalculatorVersion ??
    (0, mongoose_1.model)('CalculatorVersion', CalculatorVersionSchema);
//# sourceMappingURL=calculator-version.js.map