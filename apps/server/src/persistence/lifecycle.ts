import { LIFECYCLE_STATUSES, type LifecycleStatus } from './types';

const TRANSITIONS: Readonly<Record<LifecycleStatus, readonly LifecycleStatus[]>> = {
  draft: ['in-review', 'rejected'],
  'in-review': ['draft', 'approved', 'rejected'],
  approved: ['published', 'rejected'],
  published: ['retired'],
  retired: [],
  rejected: [],
};

export class LifecycleTransitionError extends Error {
  constructor(from: LifecycleStatus, to: LifecycleStatus) {
    super(`Lifecycle transition ${from} -> ${to} is not allowed`);
    this.name = 'LifecycleTransitionError';
  }
}

export class ImmutableVersionError extends Error {
  constructor(status: LifecycleStatus) {
    super(`Calculator version with status ${status} is immutable; create a new draft instead`);
    this.name = 'ImmutableVersionError';
  }
}

export function assertLifecycleStatus(value: string): asserts value is LifecycleStatus {
  if (!(LIFECYCLE_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unknown lifecycle status: ${value}`);
  }
}

export function assertVersionTransition(from: LifecycleStatus, to: LifecycleStatus): void {
  if (from === to || !TRANSITIONS[from].includes(to)) {
    throw new LifecycleTransitionError(from, to);
  }
}

export function assertVersionMutable(status: LifecycleStatus): void {
  if (status !== 'draft' && status !== 'in-review') {
    throw new ImmutableVersionError(status);
  }
}
