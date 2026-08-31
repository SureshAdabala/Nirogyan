"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTransaction = withTransaction;
exports.publishVersionAtomically = publishVersionAtomically;
const mongoose_1 = __importDefault(require("mongoose"));
const calculator_1 = require("./models/calculator");
const calculator_version_1 = require("./models/calculator-version");
const lifecycle_1 = require("./lifecycle");
async function withTransaction(work) {
    if (mongoose_1.default.connection.readyState !== 1) {
        throw new Error('A connected MongoDB session is required for a transaction');
    }
    const session = await mongoose_1.default.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    }
    finally {
        await session.endSession();
    }
}
/**
 * Atomically promotes an approved version and its calculator pointer. Clinical and
 * publish eligibility validation remains an explicit caller responsibility (P0A).
 */
async function publishVersionAtomically(options) {
    await options.assertPublishEligible?.();
    return withTransaction(async (session) => {
        const version = await calculator_version_1.CalculatorVersionModel.findOne({
            _id: options.versionId,
            calculatorId: options.calculatorId,
        }).session(session);
        if (!version) {
            throw new Error('Calculator version was not found');
        }
        if (version.status !== 'approved') {
            throw new Error(`Only approved versions may be published; received ${version.status}`);
        }
        (0, lifecycle_1.assertVersionTransition)(version.status, 'published');
        const now = options.now ?? new Date();
        version.status = 'published';
        version.publishedAt = now;
        version.immutableAt = now;
        await version.save({ session });
        const calculator = await calculator_1.CalculatorModel.findById(options.calculatorId).session(session);
        if (!calculator) {
            throw new Error('Calculator identity was not found');
        }
        calculator.status = 'published';
        calculator.currentVersionId = version._id;
        await calculator.save({ session });
        return version;
    });
}
//# sourceMappingURL=transactions.js.map