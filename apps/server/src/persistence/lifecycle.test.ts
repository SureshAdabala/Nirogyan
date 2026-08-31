import { describe, expect, it } from 'vitest';

import {
  assertVersionMutable,
  assertVersionTransition,
  ImmutableVersionError,
  LifecycleTransitionError,
} from './lifecycle';

describe('calculator version lifecycle', () => {
  it('allows only the locked forward transitions', () => {
    expect(() => assertVersionTransition('draft', 'in-review')).not.toThrow();
    expect(() => assertVersionTransition('approved', 'published')).not.toThrow();
    expect(() => assertVersionTransition('published', 'draft')).toThrow(LifecycleTransitionError);
  });

  it('protects published and retired versions from in-place edits', () => {
    expect(() => assertVersionMutable('draft')).not.toThrow();
    expect(() => assertVersionMutable('published')).toThrow(ImmutableVersionError);
    expect(() => assertVersionMutable('retired')).toThrow(ImmutableVersionError);
  });
});
