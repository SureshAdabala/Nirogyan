// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import type { AdminCalculatorVersion, AdminTestCase } from '@niro/contracts';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PreviewReleasePanel } from './PreviewReleasePanel';

const api = vi.hoisted(() => ({
  approveVersion: vi.fn(),
  createCalculatorVersion: vi.fn(),
  previewVersion: vi.fn(),
  publishVersion: vi.fn(),
  rollbackVersion: vi.fn(),
  runVersionTestCases: vi.fn(),
  saveVersionTestCases: vi.fn(),
  submitReview: vi.fn(),
  validateVersion: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api', () => api);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const version: AdminCalculatorVersion = {
  id: 'version-id',
  calculatorSlug: 'accessibility-fixture',
  version: 1,
  status: 'draft',
  payload: {},
  measurements: { revisionIds: [], count: 0 },
};

describe('PreviewReleasePanel accessibility', () => {
  it('makes every scrollable JSON result reachable and named for keyboard users', async () => {
    const user = userEvent.setup();
    api.previewVersion.mockResolvedValue({
      data: {
        result: {
          ok: true,
          score: 1,
          category: { label: 'Synthetic result' },
          trace: [{ operation: 'score' }],
        },
      },
    });
    api.runVersionTestCases.mockResolvedValue({ data: { passed: true, cases: [] } });
    render(
      <PreviewReleasePanel
        draft={{ testCases: [] }}
        etag="fixture-etag"
        flush={async () => 'fixture-etag'}
        history={[]}
        onValidation={vi.fn()}
        onVersion={vi.fn()}
        reloadHistory={async () => undefined}
        role="admin"
        version={version}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Run preview' }));
    await screen.findByText('Preview executed with the production engine.');
    await user.click(screen.getByText('Authorized result details'));
    await user.click(screen.getByText('Internal trace (1 steps)'));
    expect(
      screen.getByRole('region', { name: 'Authorized preview result details JSON' }),
    ).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('region', { name: 'Internal trace step 1 JSON' })).toHaveAttribute(
      'tabindex',
      '0',
    );

    await user.click(screen.getByRole('button', { name: 'Run all' }));
    await screen.findByText('All saved tests passed.');
    expect(screen.getByRole('region', { name: 'Test run result JSON' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});

describe('PreviewReleasePanel saved-test source metadata', () => {
  it('serializes schema-aligned source fields without dropping existing case provenance', async () => {
    const user = userEvent.setup();
    const sourceExample: AdminTestCase = {
      key: 'reviewed-source-example',
      name: 'Reviewed source example',
      kind: 'source-worked-example',
      inputs: { age: 40 },
      expected: { finalScore: 2, category: 'Example result' },
      source: {
        type: 'internal',
        ref: 'original-source#example',
        verification: 'needs-verification',
        title: 'Existing source title',
        claimIds: ['exampleClaim'],
      },
    };
    const boundaryCase: AdminTestCase = {
      key: 'reviewed-boundary',
      name: 'Reviewed boundary',
      kind: 'boundary',
      inputs: { age: 65 },
      expected: { finalScore: 3 },
      source: {
        type: 'external',
        ref: 'boundary-source#table-1',
        verification: 'fetch-verified',
      },
    };
    api.saveVersionTestCases.mockImplementation(
      async (_slug, _versionNumber, testCases: readonly AdminTestCase[]) => ({
        data: { version, testCases },
        etag: 'updated-etag',
      }),
    );
    render(
      <PreviewReleasePanel
        draft={{ testCases: [sourceExample, boundaryCase] }}
        etag="fixture-etag"
        flush={async () => 'fixture-etag'}
        history={[]}
        onValidation={vi.fn()}
        onVersion={vi.fn()}
        reloadHistory={async () => undefined}
        role="admin"
        version={version}
      />,
    );

    const sourceGroup = screen.getByRole('group', { name: 'Reviewed source example' });
    await user.selectOptions(within(sourceGroup).getByLabelText('Test source type'), 'niro');
    const locator = within(sourceGroup).getByLabelText('Test source locator / reference');
    await user.clear(locator);
    await user.type(locator, 'Risk calculators.xlsx#Diabetes!B5:I27');
    await user.selectOptions(
      within(sourceGroup).getByLabelText('Test source verification'),
      'source-provided',
    );
    await user.click(screen.getByRole('button', { name: 'Save tests' }));

    await waitFor(() => expect(api.saveVersionTestCases).toHaveBeenCalledTimes(1));
    const savedCases = api.saveVersionTestCases.mock.calls[0]?.[2] as readonly AdminTestCase[];
    expect(savedCases).toEqual([
      {
        ...sourceExample,
        source: {
          ...sourceExample.source,
          type: 'niro',
          ref: 'Risk calculators.xlsx#Diabetes!B5:I27',
          verification: 'source-provided',
        },
      },
      boundaryCase,
    ]);
    expect(api.approveVersion).not.toHaveBeenCalled();
    expect(api.publishVersion).not.toHaveBeenCalled();
  });

  it('omits source instead of serializing a schema-invalid empty object', async () => {
    const user = userEvent.setup();
    const testCase: AdminTestCase = {
      key: 'removable-source',
      name: 'Removable source metadata',
      kind: 'regression',
      inputs: { age: 40 },
      expected: { finalScore: 2 },
      source: {
        type: 'internal',
        ref: 'internal-fixture#case',
        verification: 'needs-verification',
      },
    };
    api.saveVersionTestCases.mockImplementation(
      async (_slug, _versionNumber, testCases: readonly AdminTestCase[]) => ({
        data: { version, testCases },
        etag: 'updated-etag',
      }),
    );
    render(
      <PreviewReleasePanel
        draft={{ testCases: [testCase] }}
        etag="fixture-etag"
        flush={async () => 'fixture-etag'}
        history={[]}
        onValidation={vi.fn()}
        onVersion={vi.fn()}
        reloadHistory={async () => undefined}
        role="admin"
        version={version}
      />,
    );

    const sourceGroup = screen.getByRole('group', { name: 'Removable source metadata' });
    await user.selectOptions(within(sourceGroup).getByLabelText('Test source type'), '');
    await user.clear(within(sourceGroup).getByLabelText('Test source locator / reference'));
    await user.selectOptions(within(sourceGroup).getByLabelText('Test source verification'), '');
    await user.click(screen.getByRole('button', { name: 'Save tests' }));

    await waitFor(() => expect(api.saveVersionTestCases).toHaveBeenCalledTimes(1));
    const savedCases = api.saveVersionTestCases.mock.calls[0]?.[2] as readonly AdminTestCase[];
    expect(savedCases).toEqual([
      {
        key: testCase.key,
        name: testCase.name,
        kind: testCase.kind,
        inputs: testCase.inputs,
        expected: testCase.expected,
      },
    ]);
  });
});
