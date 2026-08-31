import { type HydratedDocument } from 'mongoose';
export interface AnonymousVisitorDocument {
    visitorIdHash: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    consentVersion?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export type AnonymousVisitorModelDocument = HydratedDocument<AnonymousVisitorDocument>;
export declare const AnonymousVisitorModel: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<AnonymousVisitorDocument, {}, {}, {}, import("mongoose").Document<unknown, {}, AnonymousVisitorDocument, {}, {}> & AnonymousVisitorDocument & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;
//# sourceMappingURL=anonymous-visitor.d.ts.map