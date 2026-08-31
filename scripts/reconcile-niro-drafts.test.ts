import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import { validateCalculatorVersion } from '@niro/contracts';
import { calculate } from '@niro/engine';
import { describe, expect, it } from 'vitest';

import {
  applyMetadataOverlay,
  preflightNiroSources,
  readNiroSourceExtract,
  readReconciliationPlan,
  reconcileNiroDrafts,
  RECONCILIATION_ROOT,
  sha256File,
  stableP8Json,
  validateNiroSourceExtract,
  validateReconciliationArguments,
  validateReconciliationPlan,
} from './reconcile-niro-drafts';

const EXPECTED_HASHES = {
  'data/fixtures/config-samples/covid-risk.config.json':
    '82180cbfa630eba514f536419bcdb969ee74da36cca5e44236fe7f1bf8897de3',
  'data/fixtures/config-samples/diabetes-risk.config.json':
    '1dee527ed5ce64ac64f7a567577d1e3cee49a0c442a7afc2793a3b956d75152a',
  'data/fixtures/config-samples/heart-risk.config.json':
    '2c4c70c6b1264abbe2db2c12638052abbc83255fab76ef7bc06968d76c802f93',
  'data/fixtures/config-samples/hypothyroid-risk.config.json':
    'a6ebd589f2b5ae105ed3b96376bfb263e2f5ba1432d291a0e37a3988177fb7c8',
  'data/fixtures/config-samples/niro-cws.config.json':
    '42e0a1826efb32fbc7df593a5574424df08d93b855abc4026a64b4ce6bbce52e',
};

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('P8 Niro draft reconciliation safety', () => {
  it('preflights all five immutable fixtures and produces exactly four draft payloads', () => {
    const plan = readReconciliationPlan();
    expect(validateReconciliationPlan(plan)).toEqual([]);
    expect(() => preflightNiroSources()).not.toThrow();
    const before = Object.fromEntries(
      Object.keys(EXPECTED_HASHES).map((path) => [
        path,
        sha256File(join(RECONCILIATION_ROOT, path)),
      ]),
    );
    const drafts = reconcileNiroDrafts();
    const after = Object.fromEntries(
      Object.keys(EXPECTED_HASHES).map((path) => [
        path,
        sha256File(join(RECONCILIATION_ROOT, path)),
      ]),
    );
    expect(before).toEqual(EXPECTED_HASHES);
    expect(after).toEqual(EXPECTED_HASHES);
    expect(drafts.map((draft) => draft.calculatorSlug)).toEqual([
      'diabetes-risk',
      'heart-risk',
      'hypothyroid-risk',
      'niro-cws',
    ]);
    expect(drafts.every((draft) => draft.payload.status === 'draft')).toBe(true);
    expect(drafts.every((draft) => draft.publishEligible === false && draft.blockers > 0)).toBe(
      true,
    );
    for (const draft of drafts) {
      const validation = validateCalculatorVersion(
        draft.payload,
        `${draft.calculatorSlug}.p8.json`,
      );
      expect(validation.structural.passed, draft.calculatorSlug).toBe(true);
      expect(validation.publishEligible, draft.calculatorSlug).toBe(false);
    }
    expect(stableP8Json(drafts)).not.toContain('covid-19-risk-check');
    expect(stableP8Json(drafts)).not.toContain('data/catalog');
  });

  it('allows only metadata and applies every overlay idempotently', () => {
    const plan = readReconciliationPlan();
    for (const entry of plan.overlays) {
      expect(Object.keys(entry.metadataOverlay).sort()).toEqual([
        'engineSemanticVersion',
        'governance',
        'sources',
        'status',
      ]);
      const fixture = JSON.parse(
        readFileSync(join(RECONCILIATION_ROOT, entry.fixturePath), 'utf8'),
      ) as Record<string, unknown>;
      const once = applyMetadataOverlay(fixture, entry.metadataOverlay);
      const twice = applyMetadataOverlay(once, entry.metadataOverlay);
      expect(stableP8Json(twice)).toBe(stableP8Json(once));
      for (const clinicalKey of [
        'parameters',
        'scoringRules',
        'formulas',
        'domains',
        'resultCategories',
      ]) {
        expect(stableP8Json(once[clinicalKey])).toBe(stableP8Json(fixture[clinicalKey]));
      }
    }
    const clarificationIds = new Set(
      plan.overlays.flatMap((entry) => entry.metadataOverlay.governance.discrepancyIds),
    );
    for (const id of ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'C4', 'C5', 'C7']) {
      expect(clarificationIds.has(id), id).toBe(true);
    }
    expect(clarificationIds.size).toBe(80);
  });

  it('locks the checked source extract and disposes every unresolved overlay discrepancy', () => {
    const plan = readReconciliationPlan();
    expect(validateNiroSourceExtract(readNiroSourceExtract(), plan)).toEqual([]);
    expect(validateReconciliationPlan(plan)).toEqual([]);

    const drifted = structuredClone(plan);
    const cws = drifted.overlays.find((entry) => entry.calculatorSlug === 'niro-cws');
    if (!cws) throw new Error('Expected the CWS overlay.');
    Object.assign(cws, {
      resolvedByLockedContract: cws.resolvedByLockedContract.filter(
        (discrepancyId) => discrepancyId !== 'CWS-02',
      ),
    });
    expect(validateReconciliationPlan(drifted)).toContain(
      'overlays[3] does not disposition discrepancy CWS-02.',
    );

    const staleUsageDispositionRemoved = structuredClone(plan);
    const staleUsageCws = staleUsageDispositionRemoved.overlays.find(
      (entry) => entry.calculatorSlug === 'niro-cws',
    );
    if (!staleUsageCws) throw new Error('Expected the CWS overlay.');
    Object.assign(staleUsageCws, {
      resolvedByLockedContract: staleUsageCws.resolvedByLockedContract.filter(
        (discrepancyId) => discrepancyId !== 'CWS-17',
      ),
    });
    expect(validateReconciliationPlan(staleUsageDispositionRemoved)).toContain(
      'overlays[3] does not disposition discrepancy CWS-17.',
    );
  });

  it('reproduces the Heart 13-to-10 partial stage without treating it as PUB-007 evidence', () => {
    const golden = JSON.parse(
      readFileSync(join(RECONCILIATION_ROOT, 'data/goldens/heart-base-stage.v1.json'), 'utf8'),
    ) as Record<string, unknown>;
    const fixturePath = join(RECONCILIATION_ROOT, String(golden.calculatorFixture));
    expect(sha256File(fixturePath)).toBe(golden.calculatorFixtureSha256);
    const heart = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
    const supplemental = golden.executionOnlySupplementalInputs as Record<
      string,
      { readonly value: unknown }
    >;
    const inputs = {
      ...(golden.sourceInputs as Record<string, unknown>),
      ...Object.fromEntries(Object.entries(supplemental).map(([key, value]) => [key, value.value])),
    };
    const result = calculate(heart, inputs);
    const expected = (
      golden.expectedIntermediate as { readonly formulas: Readonly<Record<string, number>> }
    ).formulas;
    expect(result.formulas['base-points']).toBe(expected['base-points']);
    expect(result.formulas['base-risk']).toBe(expected['base-risk']);
    expect((golden.publishGate as { readonly satisfiesPUB007: boolean }).satisfiesPUB007).toBe(
      false,
    );
  });

  it('refuses source drift before producing a candidate payload', () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), 'niro-p8-drift-'));
    const plan = readReconciliationPlan();
    for (const path of [
      ...Object.keys(plan.sourceFixtureHashes),
      ...Object.keys(plan.sourceArtifactHashes),
    ]) {
      const source = join(RECONCILIATION_ROOT, path);
      const target = join(temporaryRoot, path);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(source, target, { recursive: false, force: true });
    }
    const driftPath = join(temporaryRoot, 'data/fixtures/config-samples/heart-risk.config.json');
    writeFileSync(driftPath, `${readFileSync(driftPath, 'utf8')}\n`, 'utf8');
    expect(hash(readFileSync(driftPath))).not.toBe(
      EXPECTED_HASHES['data/fixtures/config-samples/heart-risk.config.json'],
    );
    expect(() => preflightNiroSources(temporaryRoot, plan)).toThrow(
      'fixture hash drift at data/fixtures/config-samples/heart-risk.config.json',
    );
  });

  it('rejects catalog/COVID paths and clinical fields in an overlay', () => {
    const plan = structuredClone(readReconciliationPlan());
    const first = plan.overlays[0];
    if (!first) throw new Error('Expected an overlay.');
    Object.assign(first, {
      calculatorSlug: 'covid-19-risk-check',
      fixturePath: 'data/catalog/calculators/diabetes-risk.config.json',
      metadataOverlay: { ...first.metadataOverlay, formulas: [] },
    });
    const findings = validateReconciliationPlan(plan);
    expect(findings.some((finding) => finding.includes('exact allowlisted'))).toBe(true);
    expect(findings.some((finding) => finding.includes('must not include the COVID'))).toBe(true);
    expect(findings.some((finding) => finding.includes('non-metadata top-level'))).toBe(true);
    expect(findings.some((finding) => finding.includes('forbidden clinical fields'))).toBe(true);
  });

  it('keeps reconciliation read-only and rejects the superseded importer', () => {
    expect(() => validateReconciliationArguments([])).not.toThrow();
    expect(() => validateReconciliationArguments(['--emit-payloads'])).not.toThrow();
    expect(() => validateReconciliationArguments(['--import-admin-api'])).toThrow(
      'legacy reconciliation importer is disabled',
    );
    expect(() => validateReconciliationArguments(['--unknown'])).toThrow(
      'Unsupported reconciliation argument',
    );
  });
});
