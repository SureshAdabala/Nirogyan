import type { Types } from 'mongoose';
export declare const LIFECYCLE_STATUSES: readonly ["draft", "in-review", "approved", "published", "retired", "rejected"];
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];
export type ObjectIdLike = Types.ObjectId;
//# sourceMappingURL=types.d.ts.map