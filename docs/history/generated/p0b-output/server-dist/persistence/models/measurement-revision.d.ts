import { type HydratedDocument } from 'mongoose';
export interface MeasurementRevisionDocument {
    key: string;
    revision: number;
    status: 'draft' | 'verified' | 'retired';
    displayName: string;
    kind: 'biomarker' | 'demographic' | 'lifestyle' | 'derived';
    canonicalUnit?: string;
    definition: Record<string, unknown>;
    definitionHash: string;
    sources: unknown[];
    createdAt: Date;
    updatedAt: Date;
}
export type MeasurementRevisionModelDocument = HydratedDocument<MeasurementRevisionDocument>;
export declare const MeasurementRevisionModel: import("mongoose").Model<any, {}, {}, {}, any, any> | import("mongoose").Model<MeasurementRevisionDocument, {}, {}, {}, import("mongoose").Document<unknown, {}, MeasurementRevisionDocument, {}, {}> & MeasurementRevisionDocument & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>;
//# sourceMappingURL=measurement-revision.d.ts.map