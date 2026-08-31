import { type LifecycleStatus } from './types';
export declare class LifecycleTransitionError extends Error {
    constructor(from: LifecycleStatus, to: LifecycleStatus);
}
export declare class ImmutableVersionError extends Error {
    constructor(status: LifecycleStatus);
}
export declare function assertLifecycleStatus(value: string): asserts value is LifecycleStatus;
export declare function assertVersionTransition(from: LifecycleStatus, to: LifecycleStatus): void;
export declare function assertVersionMutable(status: LifecycleStatus): void;
//# sourceMappingURL=lifecycle.d.ts.map