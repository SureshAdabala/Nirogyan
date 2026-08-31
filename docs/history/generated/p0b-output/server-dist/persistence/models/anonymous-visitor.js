"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnonymousVisitorModel = void 0;
const mongoose_1 = require("mongoose");
const AnonymousVisitorSchema = new mongoose_1.Schema({
    visitorIdHash: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    consentVersion: { type: String },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { collection: 'anonymous_visitors', timestamps: true });
AnonymousVisitorSchema.index({ visitorIdHash: 1 }, { unique: true });
AnonymousVisitorSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.AnonymousVisitorModel = mongoose_1.models.AnonymousVisitor ??
    (0, mongoose_1.model)('AnonymousVisitor', AnonymousVisitorSchema);
//# sourceMappingURL=anonymous-visitor.js.map