import { Types, type HydratedDocument, type Model } from 'mongoose';
import { type LifecycleStatus } from '../types';
export interface CalculatorVersionDocument {
    calculatorId: Types.ObjectId;
    calculatorSlug: string;
    version: number;
    status: LifecycleStatus;
    schemaId: string;
    engineSemanticVersion: string;
    payload: Record<string, unknown>;
    measurementRevisionIds: string[];
    measurementSnapshots: unknown[];
    sourceHash?: string;
    logicHash?: string;
    contentHash?: string;
    reviewHash?: string;
    versionHash?: string;
    createdBy?: Types.ObjectId;
    approvedBy?: Types.ObjectId;
    publishedAt?: Date;
    immutableAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export type CalculatorVersionModelDocument = HydratedDocument<CalculatorVersionDocument>;
export declare const CalculatorVersionModel: Model<CalculatorVersionDocument>;
//# sourceMappingURL=calculator-version.d.ts.map