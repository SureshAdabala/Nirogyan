import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export interface MeasurementStructuralFinding {
  readonly instancePath: string;
  readonly message: string;
}

let validator: ValidateFunction | undefined;

function measurementSchemaPath(): string {
  const candidates = [
    join(__dirname, '..', '..', 'schemas', 'measurement-definition.v1.schema.json'),
    join(
      process.cwd(),
      'packages',
      'contracts',
      'schemas',
      'measurement-definition.v1.schema.json',
    ),
    join(process.cwd(), 'schemas', 'measurement-definition.v1.schema.json'),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error('measurement-definition.v1.schema.json could not be resolved.');
  return found;
}

function structuralValidator(): ValidateFunction {
  if (validator) return validator;
  const schema = JSON.parse(readFileSync(measurementSchemaPath(), 'utf8')) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true });
  addFormats(ajv, { mode: 'full' });
  validator = ajv.compile(schema);
  return validator;
}

export function validateMeasurementDefinitionStructure(value: unknown): {
  readonly valid: boolean;
  readonly findings: readonly MeasurementStructuralFinding[];
} {
  const validate = structuralValidator();
  const valid = validate(value);
  return {
    valid: Boolean(valid),
    findings: valid
      ? []
      : (validate.errors ?? []).map((error: ErrorObject) => ({
          instancePath: error.instancePath,
          message: error.message ?? 'Schema validation failed.',
        })),
  };
}
