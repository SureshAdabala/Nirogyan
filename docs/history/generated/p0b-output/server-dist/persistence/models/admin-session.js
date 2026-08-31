"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSessionModel = void 0;
const mongoose_1 = require("mongoose");
const AdminSessionSchema = new mongoose_1.Schema({
    adminUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    tokenFamilyId: { type: String, required: true },
    refreshTokenHash: { type: String, required: true, select: false },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    reuseDetectedAt: { type: Date },
    ipHash: { type: String },
    userAgent: { type: String },
}, { collection: 'admin_sessions', timestamps: true });
AdminSessionSchema.index({ tokenFamilyId: 1 }, { unique: true });
AdminSessionSchema.index({ adminUserId: 1, expiresAt: 1 });
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.AdminSessionModel = mongoose_1.models.AdminSession ?? (0, mongoose_1.model)('AdminSession', AdminSessionSchema);
//# sourceMappingURL=admin-session.js.map