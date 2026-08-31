// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CalculatorRenderer } from './CalculatorRenderer';
import { FieldRegistry } from './fields/registry';
import { progressStorageKey, saveProgress, type StorageLike } from './progress-storage';
import { createInitialRendererState } from './reducer';
import { nonclinicalBatchFixture, rendererFixture } from './test-fixture';
import type { AssessmentPayload, PublicCalculatorConfig } from './types';
import { ResultRenderer } from '../result/ResultRenderer';
import type { ResultProjection } from '../result/types';

afterEach(cleanup);

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

type RendererUser = ReturnType<typeof userEvent.setup>;

interface RendererSample {
  readonly name: string;
  readonly createConfig: () => PublicCalculatorConfig;
  readonly initialHeading: string;
  readonly complete: (user: RendererUser) => Promise<void>;
  readonly expectedPayload: {
    readonly inputs: AssessmentPayload['inputs'];
    readonly omitted: readonly string[];
  };
  readonly result: ResultProjection;
  readonly expectedResultHeadings: readonly string[];
}

const rendererSamples: readonly RendererSample[] = [
  {
    name: 'multi-step unit-aware fixture',
    createConfig: rendererFixture,
    initialHeading: 'First step',
    complete: async (user) => {
      await user.type(screen.getByRole('spinbutton', { name: /Quantity/ }), '4');
      await user.selectOptions(screen.getByRole('combobox', { name: /Mode/ }), '0');
      await user.click(screen.getByRole('radio', { name: 'No' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      expect(screen.getByRole('heading', { name: 'Second step' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Calculate' }));
    },
    expectedPayload: {
      inputs: {
        quantity: { value: 4, unit: 'base-unit' },
        mode: 'simple',
        enabled: false,
      },
      omitted: [],
    },
    result: {
      score: 4,
      category: { label: 'Synthetic category' },
      recommendations: ['Synthetic recommendation.'],
    },
    expectedResultHeadings: ['Result', 'Category'],
  },
  {
    name: 'independent single-step conditional fixture',
    createConfig: nonclinicalBatchFixture,
    initialHeading: 'Configure a synthetic batch',
    complete: async (user) => {
      expect(screen.queryByRole('combobox', { name: /Label shape/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: 'Yes' }));
      await user.selectOptions(screen.getByRole('combobox', { name: /Label shape/ }), '0');
      await user.type(screen.getByRole('spinbutton', { name: /Batch count/ }), '3');
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Calculate' }));
    },
    expectedPayload: {
      inputs: { includeLabel: true, labelShape: 'round', batchCount: 3 },
      omitted: [],
    },
    result: {
      score: 3,
      category: { label: 'Synthetic category' },
      recommendations: ['Synthetic recommendation.'],
    },
    expectedResultHeadings: ['Category', 'Recommendations', 'Result'],
  },
];

describe('generic CalculatorRenderer', () => {
  it('registers only the three v1 authored input types', () => {
    expect(Object.keys(FieldRegistry)).toEqual(['number', 'select', 'boolean']);
  });

  it.each(rendererSamples)(
    'completes a form and configured result journey for the $name',
    async ({
      createConfig,
      initialHeading,
      complete,
      expectedPayload,
      result,
      expectedResultHeadings,
    }) => {
      const config = createConfig();
      const user = userEvent.setup();
      const onSubmit = vi.fn<(payload: AssessmentPayload) => Promise<void>>(async () => undefined);
      const form = render(
        <CalculatorRenderer config={config} storage={null} onSubmit={onSubmit} />,
      );

      expect(screen.getByRole('heading', { name: initialHeading })).toBeInTheDocument();
      await complete(user);
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject(expectedPayload);
      expect(onSubmit.mock.calls[0]?.[0].idempotencyKey).toMatch(/^[A-Za-z0-9._~-]{8,128}$/);

      form.unmount();
      const { container } = render(
        <ResultRenderer
          projection={result}
          presentation={{
            calculatorSlug: config.calculatorSlug,
            calculatorVersion: config.version,
            calculatorName: config.name,
            layout: config.uiConfig.result.layout,
          }}
        />,
      );
      expect(screen.getByRole('heading', { name: `${config.name} result` })).toBeInTheDocument();
      expect(
        [...container.querySelectorAll('.result-block > h3')].map((item) => item.textContent),
      ).toEqual(expectedResultHeadings);
    },
  );

  it('renders ordered, labelled native controls while derived/server-only fields stay hidden', () => {
    render(
      <CalculatorRenderer config={rendererFixture()} storage={null} onSubmit={() => undefined} />,
    );
    expect(screen.getByRole('progressbar')).toHaveTextContent('Step 1 of 2');
    expect(screen.getByRole('heading', { name: 'First step' })).toBeInTheDocument();
    const quantity = screen.getByRole('spinbutton', { name: /Quantity/ });
    const mode = screen.getByRole('combobox', { name: /Mode/ });
    expect(quantity.compareDocumentPosition(mode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Yes' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'No' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: "I don't have this value" })).toBeInTheDocument();
    expect(screen.queryByText('Derived value')).not.toBeInTheDocument();
    expect(screen.queryByText('Server-only visibility value')).not.toBeInTheDocument();
    expect(screen.queryByText('Optional value')).not.toBeInTheDocument();
  });

  it('validates a step, focuses its first error, preserves physical units, and builds omissions', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(payload: AssessmentPayload) => Promise<void>>(async () => undefined);
    render(<CalculatorRenderer config={rendererFixture()} storage={null} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const quantity = screen.getByRole('spinbutton', { name: /Quantity/ });
    expect(screen.getByText('Quantity is required.')).toBeInTheDocument();
    expect(quantity).toHaveFocus();

    await user.type(quantity, '200');
    await user.selectOptions(screen.getByRole('combobox', { name: /Mode/ }), '0');
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('checkbox', { name: "I don't have this value" }));

    const unit = screen.getByRole('combobox', { name: 'Unit for Quantity' });
    await user.selectOptions(unit, 'large-unit');
    expect(quantity).toHaveValue(2);

    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Second step' })).toHaveFocus();
    expect(screen.getByText('Optional value')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: "I don't have this value" }));
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      inputs: {
        quantity: { value: 2, unit: 'large-unit' },
        mode: 'simple',
        enabled: true,
      },
      omitted: ['optionalChoice', 'optionalValue'],
    });
    expect(onSubmit.mock.calls[0]?.[0].idempotencyKey).toMatch(/^[A-Za-z0-9._~-]{8,128}$/);
  });

  it('maps server inputs.<key> findings, returns to the owning step, and focuses the field', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(payload: AssessmentPayload) => Promise<void>>(async () => {
      throw {
        fields: { 'inputs.quantity': { code: 'INVALID_INPUT', message: 'Server rejected it.' } },
      };
    });
    render(<CalculatorRenderer config={rendererFixture()} storage={null} onSubmit={onSubmit} />);

    await user.type(screen.getByRole('spinbutton', { name: /Quantity/ }), '4');
    await user.selectOptions(screen.getByRole('combobox', { name: /Mode/ }), '0');
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Calculate' }));

    expect(await screen.findByText('Server rejected it.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First step' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /Quantity/ })).toHaveFocus();
  });

  it('persists only this calculator version and clears its progress on start over', async () => {
    const user = userEvent.setup();
    const config = rendererFixture();
    const storage = new MemoryStorage();
    render(<CalculatorRenderer config={config} storage={storage} onSubmit={() => undefined} />);

    const quantity = screen.getByRole('spinbutton', { name: /Quantity/ });
    await user.type(quantity, '4');
    await waitFor(() => expect(storage.getItem(progressStorageKey(config))).toContain('quantity'));

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await waitFor(() => expect(storage.getItem(progressStorageKey(config))).toBeNull());
    expect(quantity).toHaveValue(null);
  });

  it('hydrates deterministic step-one SSR before restoring the exact saved step', async () => {
    const config = rendererFixture();
    const storage = new MemoryStorage();
    saveProgress(storage, config, {
      ...createInitialRendererState(config),
      values: { quantity: 4, mode: 'simple', enabled: true, optionalValue: 7 },
      currentStep: 1,
    });

    const element = (
      <CalculatorRenderer config={config} storage={storage} onSubmit={() => undefined} />
    );
    const serverHtml = renderToString(element);
    expect(serverHtml).toContain('First step');

    const container = document.createElement('div');
    container.innerHTML = serverHtml;
    expect(container.querySelector('h2')).toHaveTextContent('First step');
    document.body.append(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, element);
      });
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Second step' })).toBeInTheDocument();
      });
      expect(screen.getByRole('spinbutton', { name: /Optional value/ })).toHaveValue(7);
      const hydrationErrors = consoleError.mock.calls.filter((args) =>
        args.some((value) => /hydration|did not match|server rendered html/i.test(String(value))),
      );
      expect(hydrationErrors).toEqual([]);
    } finally {
      if (root) {
        await act(async () => root?.unmount());
      }
      consoleError.mockRestore();
      container.remove();
    }
  });
});
