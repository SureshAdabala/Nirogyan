import type { AppEnvironment } from './config/env';
import {
  createMongoAssessmentStore,
  createMongoLeadStore,
  type AssessmentStore,
  type LeadStore,
} from './modules/public';

export interface ServerPersistenceDependencies {
  readonly assessmentStore: AssessmentStore | undefined;
  readonly leadCapture:
    | {
        readonly store: LeadStore;
        readonly consentVersion: string;
      }
    | undefined;
}

/**
 * Construct the public persistence dependencies used by the real server.
 *
 * A Mongo-backed server must never start in the misleading state where catalog
 * reads work but every valid assessment fails later with a persistence 503.
 * Production already requires an explicit, approved retention period during
 * environment validation; this startup assertion applies the same fail-closed
 * invariant to development and test server processes without inventing a
 * retention policy.
 */
export function createServerPersistenceDependencies(
  environment: AppEnvironment,
): ServerPersistenceDependencies {
  if (environment.mongoUri && environment.assessmentRetentionDays === undefined) {
    throw new Error(
      'ASSESSMENT_RETENTION_DAYS is required when MONGODB_URI is configured; refusing to start without assessment/result persistence.',
    );
  }

  return {
    assessmentStore:
      environment.mongoUri && environment.assessmentRetentionDays !== undefined
        ? createMongoAssessmentStore({ retentionDays: environment.assessmentRetentionDays })
        : undefined,
    leadCapture:
      environment.mongoUri &&
      environment.leadRetentionDays !== undefined &&
      environment.leadConsentVersion !== undefined
        ? {
            store: createMongoLeadStore({ retentionDays: environment.leadRetentionDays }),
            consentVersion: environment.leadConsentVersion,
          }
        : undefined,
  };
}
