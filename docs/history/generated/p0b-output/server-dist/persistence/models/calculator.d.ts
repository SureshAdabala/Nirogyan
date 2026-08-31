import { Types, type HydratedDocument, type Model } from 'mongoose';
import { type LifecycleStatus } from '../types';
export interface CalculatorDocument {
    slug: string;
    name: string;
    status: LifecycleStatus;
    currentVersionId?: Types.ObjectId;
    draftVersionId?: Types.ObjectId;
    createdBy?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export type CalculatorModelDocument = HydratedDocument<CalculatorDocument>;
export declare const CalculatorModel: Model<CalculatorDocument>;
//# sourceMappingURL=calculator.d.ts.map