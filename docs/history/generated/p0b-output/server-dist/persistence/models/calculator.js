"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculatorModel = void 0;
const mongoose_1 = require("mongoose");
const types_1 = require("../types");
const CalculatorSchema = new mongoose_1.Schema({
    slug: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: types_1.LIFECYCLE_STATUSES, required: true, default: 'draft' },
    currentVersionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    draftVersionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CalculatorVersion' },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AdminUser' },
}, { collection: 'calculators', timestamps: true });
CalculatorSchema.index({ slug: 1 }, { unique: true });
CalculatorSchema.index({ status: 1, updatedAt: -1 });
exports.CalculatorModel = mongoose_1.models.Calculator ??
    (0, mongoose_1.model)('Calculator', CalculatorSchema);
//# sourceMappingURL=calculator.js.map