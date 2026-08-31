import { describe, expect, it } from 'vitest';

import {
  clearProgress,
  progressStorageKey,
  restoreProgress,
  saveProgress,
  type StorageLike,
} from './progress-storage';
import { createInitialRendererState, rendererReducer } from './reducer';
import {
  buildAssessmentPayload,
  createIdempotencyManager,
  mapServerFieldErrors,
  submissionErrorMessage,
} from './submission';
import { rendererFixture } from './test-fixture';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('renderer reducer and progress storage', () => {
  it('initializes canonical units and clears a field error when its answer changes', () => {
    const config = rendererFixture();
    const initial = createInitialRendererState(config);
    expect(initial.units).toMatchObject({ quantity: 'base-unit', optionalValue: 'unit' });
    const withError = rendererReducer(initial, {
      type: 'replace-errors',
      errors: { quantity: 'Required' },
    });
    const changed = rendererReducer(withError, { type: 'set-value', key: 'quantity', value: 4 });
    expect(changed.values.quantity).toBe(4);
    expect(changed.errors.quantity).toBeUndefined();
  });

  it('restores only config-valid keys, values, units and skippable flags', () => {
    const config = rendererFixture();
    const storage = new MemoryStorage();
    storage.setItem(
      progressStorageKey(config),
      JSON.stringify({
        schemaVersion: 1,
        calculatorSlug: config.calculatorSlug,
        calculatorVersion: config.version,
        values: {
          quantity: 20,
          mode: 'not-configured',
          enabled: false,
          unknown: 'discard-me',
        },
        units: { quantity: 'large-unit', unknown: 'unit' },
        skipped: { optionalValue: true, quantity: true, unknown: true },
        currentStep: 99,
      }),
    );
    expect(restoreProgress(storage, config)).toEqual({
      values: { enabled: false },
      units: { quantity: 'large-unit', optionalValue: 'unit' },
      skipped: { optionalValue: true },
      errors: {},
      currentStep: 1,
    });
  });

  it('persists without errors and clears only the version-scoped key', () => {
    const config = rendererFixture();
    const storage = new MemoryStorage();
    const state = {
      ...createInitialRendererState(config),
      values: { quantity: 2 },
      errors: { quantity: 'temporary' },
    };
    expect(saveProgress(storage, config, state)).toBe(true);
    expect(storage.getItem(progressStorageKey(config))).not.toContain('temporary');
    storage.setItem('unrelated', 'preserve');
    expect(clearProgress(storage, config)).toBe(true);
    expect(storage.getItem('unrelated')).toBe('preserve');
  });
});

describe('assessment payload and idempotency boundary', () => {
  it('submits only visible answers, preserves entered units and emits explicit omissions', () => {
    const config = rendererFixture();
    const state = {
      ...createInitialRendererState(config),
      values: {
        quantity: 2,
        mode: 'simple' as const,
        enabled: true,
        optionalValue: 8,
        serverOnlyValue: 9,
      },
      units: { quantity: 'large-unit', optionalValue: 'unit' },
      skipped: { optionalValue: true },
    };
    expect(buildAssessmentPayload(config, state)).toEqual({
      inputs: {
        quantity: { value: 2, unit: 'large-unit' },
        mode: 'simple',
        enabled: true,
      },
      omitted: ['optionalValue'],
    });
  });

  it('keeps one key for a retry and renews after payload change or success', () => {
    const keys = ['key-one-123', 'key-two-123', 'key-three-123'];
    const manager = createIdempotencyManager(() => {
      const key = keys.shift();
      if (!key) throw new Error('test key exhausted');
      return key;
    });
    const first = { inputs: { value: 1 }, omitted: [] } as const;
    const changed = { inputs: { value: 2 }, omitted: [] } as const;
    expect(manager.attach(first).idempotencyKey).toBe('key-one-123');
    expect(manager.attach(first).idempotencyKey).toBe('key-one-123');
    manager.payloadChanged(changed);
    expect(manager.attach(first).idempotencyKey).toBe('key-two-123');
    manager.succeeded(first);
    expect(manager.attach(first).idempotencyKey).toBe('key-three-123');
  });

  it('maps only known server inputs.<key> findings', () => {
    expect(
      mapServerFieldErrors(
        {
          'inputs.quantity': { code: 'INVALID_INPUT', message: 'Check quantity.' },
          'inputs.quantity.unit': { message: 'Check the selected unit.' },
          quantity: 'A non-input field must not be mapped.',
          unknown: 'Do not expose this.',
        },
        new Set(['quantity']),
      ),
    ).toEqual({ quantity: 'Check the selected unit.' });
  });

  it('keeps the typed retry delay in a rate-limit message', () => {
    expect(
      submissionErrorMessage({
        message: 'Too many requests.',
        retryAfter: '60',
      }),
    ).toBe('Too many requests. Try again in 60 seconds.');
  });
});
