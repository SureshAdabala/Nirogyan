/**
 * Public identifiers for the normative P0A contracts.
 *
 * The schema/specification files remain the source of truth. This package
 * intentionally does not duplicate schema meaning or implement validation.
 */
export const CONTRACT_PACKAGE_VERSION = '0.1.0' as const;

export const CONTRACT_SCHEMA_IDS = {
  calculatorVersion: 'urn:niro:schema:calculator-version:v1',
  measurementDefinition: 'urn:niro:schema:measurement-definition:v1',
  contentPage: 'urn:niro:schema:content-page:v1',
} as const;

export type ContractSchemaId = (typeof CONTRACT_SCHEMA_IDS)[keyof typeof CONTRACT_SCHEMA_IDS];

export { validateCalculatorJson, validateCalculatorVersion } from './validation/calculator';
export { validateMeasurementDefinitionStructure } from './validation/measurement';
export type { MeasurementStructuralFinding } from './validation/measurement';
export type {
  CalculatorValidationResult,
  FindingSeverity,
  FindingStatus,
  ValidationEvidence,
  ValidationFinding,
  ValidationLayer,
  ValidationLayerResult,
} from './validation/types';

export type { NiroCalculatorVersionV1 as CalculatorVersionV1 } from './generated/calculator-version.v1';
export type { NiroCalculatorContentPageV1 as ContentPageV1 } from './generated/content-page.v1';
export type { NiroMeasurementDefinitionV1 as MeasurementDefinitionV1 } from './generated/measurement-definition.v1';

export type {
  AdminApiDataEnvelope,
  AdminApiErrorBody,
  AdminApiRole,
  AdminCalculatorLifecycleStatus,
  AdminCalculatorSummary,
  AdminCalculatorVersion,
  AdminCreateCalculatorRequest,
  AdminCreateCalculatorVersionRequest,
  AdminIdentity,
  AdminMeasurementBindingSummary,
  AdminReviewEvidenceSnapshot,
  AdminTestCase,
  AdminTestCaseSource,
  AdminTestCaseRunResult,
  AdminTestRunSummary,
  AdminUpdateCalculatorVersionRequest,
  AdminValidationSummary,
} from './admin-api';

export type {
  AnalyticsCalculatorEngagement,
  AnalyticsEngagementResponse,
  AnalyticsFunnelResponse,
  AnalyticsIdentityBasis,
  AnalyticsLeadsResponse,
  AnalyticsOpsResponse,
  AnalyticsOverviewResponse,
  AnalyticsRankedValue,
  AnalyticsScoresResponse,
  AnalyticsSecurityResponse,
  AnalyticsTrendPoint,
  AnalyticsWindowSummary,
  AnalyticsEventType,
} from './analytics-api';
export { ANALYTICS_EVENT_TYPES } from './analytics-api';

export {
  collectCoreMeasurementConfigUsage,
  CORE_MEASUREMENT_SEED_SCHEMA_VERSION,
  CORE_MEASUREMENT_SOURCE_PATH,
  CORE_SCORING_CONFIG_PATH,
  CORE_SCORING_RESEARCH_PATH,
  migrateCoreMeasurementSeed,
  stableJsonStringify,
  validateCoreMeasurementSeed,
} from './measurement-seed';
export type {
  CoreMeasurementConfigInput,
  CoreMeasurementConfigUsage,
  CoreMeasurementSeed,
  CoreMeasurementSeedFinding,
  CoreMeasurementSeedRecord,
  CoreMeasurementSeedValidation,
  CoreMeasurementValueTag,
  JsonObject,
  JsonValue,
} from './measurement-seed';

export type {
  PublicAssessmentRequest,
  PublicAssessmentResponse,
  PublicBiomarkerCalculatorUsage,
  PublicBiomarkerDefinition,
  PublicBiomarkerDetail,
  PublicBiomarkerRangeContext,
  PublicBiomarkerReferenceRange,
  PublicBiomarkerSource,
  PublicBiomarkerSummary,
  PublicCalculatorConfig,
  PublicCalculatorSummary,
  PublicCondition,
  PublicConditionPredicate,
  PublicContentBlock,
  PublicContentPage,
  PublicLeadRequest,
  PublicMeasurementConversion,
  PublicMeasurementInterval,
  PublicMeasurementKind,
  PublicMeasurementUnit,
  PublicParameter,
  PublicRelatedBiomarker,
  PublicResultBlock,
  PublicResultCategory,
  PublicResultPresentation,
  PublicScalar,
  PublicSharedResult,
} from './public-api';
