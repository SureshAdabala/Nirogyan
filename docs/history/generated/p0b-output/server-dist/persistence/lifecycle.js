"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImmutableVersionError = exports.LifecycleTransitionError = void 0;
exports.assertLifecycleStatus = assertLifecycleStatus;
exports.assertVersionTransition = assertVersionTransition;
exports.assertVersionMutable = assertVersionMutable;
const types_1 = require("./types");
const TRANSITIONS = {
    draft: ['in-review', 'rejected'],
    'in-review': ['draft', 'approved', 'rejected'],
    approved: ['published', 'rejected'],
    published: ['retired'],
    retired: [],
    rejected: [],
};
class LifecycleTransitionError extends Error {
    constructor(from, to) {
        super(`Lifecycle transition ${from} -> ${to} is not allowed`);
        this.name = 'LifecycleTransitionError';
    }
}
exports.LifecycleTransitionError = LifecycleTransitionError;
class ImmutableVersionError extends Error {
    constructor(status) {
        super(`Calculator version with status ${status} is immutable; create a new draft instead`);
        this.name = 'ImmutableVersionError';
    }
}
exports.ImmutableVersionError = ImmutableVersionError;
function assertLifecycleStatus(value) {
    if (!types_1.LIFECYCLE_STATUSES.includes(value)) {
        throw new Error(`Unknown lifecycle status: ${value}`);
    }
}
function assertVersionTransition(from, to) {
    if (from === to || !TRANSITIONS[from].includes(to)) {
        throw new LifecycleTransitionError(from, to);
    }
}
function assertVersionMutable(status) {
    if (status !== 'draft' && status !== 'in-review') {
        throw new ImmutableVersionError(status);
    }
}
//# sourceMappingURL=lifecycle.js.map