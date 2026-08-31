import mongoose, { type ClientSession } from 'mongoose';
export declare function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T>;
export interface PublishVersionOptions {
    readonly calculatorId: mongoose.Types.ObjectId;
    readonly versionId: mongoose.Types.ObjectId;
    readonly assertPublishEligible?: () => void | Promise<void>;
    readonly now?: Date;
}
/**
 * Atomically promotes an approved version and its calculator pointer. Clinical and
 * publish eligibility validation remains an explicit caller responsibility (P0A).
 */
export declare function publishVersionAtomically(options: PublishVersionOptions): Promise<mongoose.Document<unknown, {}, import("./models/calculator-version").CalculatorVersionDocument, {}, {}> & import("./models/calculator-version").CalculatorVersionDocument & {
    _id: mongoose.Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=transactions.d.ts.map