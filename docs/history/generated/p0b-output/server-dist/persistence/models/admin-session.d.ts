import { Types, type HydratedDocument } from 'mongoose';
export interface AdminSessionDocument {
    adminUserId: Types.ObjectId;
    tokenFamilyId: string;
    refreshTokenHash: string;
    issuedAt: Date;
    expiresAt: Date;
    revokedAt?: Date;
    reuseDetectedAt?: Date;
    ipHash?: string;
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
}
export type AdminSessionModelDocument = HydratedDocument<AdminSessionDocument>;
export declare const AdminSessionModel: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<AdminSessionDocument, {}, {}, {}, import("mongoose").Document<unknown, {}, AdminSessionDocument, {}, {}> & AdminSessionDocument & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, any>;
//# sourceMappingURL=admin-session.d.ts.map