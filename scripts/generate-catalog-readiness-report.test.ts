import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildCatalogReadinessReport,
  checkCatalogReadinessArtifacts,
  generatedCatalogReadinessArtifacts,
  validateCatalogReadinessArguments,
} from './generate-catalog-readiness-report';

describe('catalog publication-readiness reporting', () => {
  it('processes every research calculator and measurement individually and fails closed', () => {
    const report = buildCatalogReadinessReport();
    expect(report.summary).toMatchObject({
      calculatorResearchRecords: 62,
      calculatorPublicationEligible: 0,
      calculatorQuarantined: 62,
      measurementResearchRecords: 79,
      measurementPublicationEligible: 0,
      measurementQuarantined: 79,
      genuinelyNewMeasurementCandidates: 65,
      libraryEnrichments: 14,
      knownReversedConversionRecords: 20,
      measurementSourceObjects: 143,
    });
    expect(new Set(report.calculators.map((record) => record.key))).toHaveLength(62);
    expect(new Set(report.measurements.map((record) => record.key))).toHaveLength(79);
    expect(report.calculators.every((record) => record.blockers.length >= 5)).toBe(true);
    expect(report.measurements.every((record) => record.blockers.length >= 4)).toBe(true);
  });

  it('records the exact known conversion and source-reverification boundaries', () => {
    const report = buildCatalogReadinessReport();
    const hematocrit = report.measurements.find((record) => record.key === 'hematocrit');
    const insulin = report.measurements.find((record) => record.key === 'fasting-insulin');
    const bmi = report.calculators.find((record) => record.key === 'bmi');
    expect(hematocrit?.blockers.map((blocker) => blocker.id)).toContain(
      'CAT-MEAS-CONVERSION-REVERSED',
    );
    expect(insulin?.blockers.map((blocker) => blocker.id)).toContain('CAT-MEAS-CONVERSION-SPECIAL');
    expect(bmi?.blockers.map((blocker) => blocker.id)).toContain('CAT-CALC-SOURCE-REVERIFY');
  });

  it('generates stable checked artifacts without modifying either research catalog', () => {
    const beforeCalculators = readFileSync('data/catalog/health-calculator-catalog.json', 'utf8');
    const beforeMeasurements = readFileSync(
      'data/catalog/measurements-reference-extension.json',
      'utf8',
    );
    const once = generatedCatalogReadinessArtifacts();
    const twice = generatedCatalogReadinessArtifacts();
    expect(twice).toEqual(once);
    expect(checkCatalogReadinessArtifacts()).toEqual([]);
    expect(readFileSync('data/catalog/health-calculator-catalog.json', 'utf8')).toBe(
      beforeCalculators,
    );
    expect(readFileSync('data/catalog/measurements-reference-extension.json', 'utf8')).toBe(
      beforeMeasurements,
    );
  });

  it('requires an explicit mode and rejects ambiguous or import-like arguments', () => {
    expect(validateCatalogReadinessArguments([])).toBe('check');
    expect(validateCatalogReadinessArguments(['--check'])).toBe('check');
    expect(validateCatalogReadinessArguments(['--write'])).toBe('write');
    expect(() => validateCatalogReadinessArguments(['--write', '--check'])).toThrow(
      '--write and --check are mutually exclusive.',
    );
    expect(() => validateCatalogReadinessArguments(['--import'])).toThrow(
      'Unsupported catalog-readiness argument: --import.',
    );
  });
});
