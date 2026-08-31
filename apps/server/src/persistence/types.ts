import type { Types } from 'mongoose';

export const LIFECYCLE_STATUSES = [
  'draft',
  'in-review',
  'approved',
  'published',
  'retired',
  'rejected',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type ObjectIdLike = Types.ObjectId;
