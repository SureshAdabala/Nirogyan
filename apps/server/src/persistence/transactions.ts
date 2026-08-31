import mongoose, { type ClientSession } from 'mongoose';

import { AuditLogModel } from './models/audit-log';
import { CacheInvalidationEventModel } from './models/cache-invalidation-event';
import { CalculatorModel } from './models/calculator';
import { CalculatorVersionModel } from './models/calculator-version';
import { assertVersionTransition } from './lifecycle';
import type { CalculatorVersionModelDocument } from './models/calculator-version';

export class PersistenceConflictError extends Error {
  constructor(message = 'The persisted resource changed; reload and retry.') {
    super(message);
    this.name = 'PersistenceConflictError';
  }
}

export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('A connected MongoDB session is required for a transaction');
  }

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export interface PublishVersionOptions {
  readonly calculatorId: mongoose.Types.ObjectId;
  readonly versionId: mongoose.Types.ObjectId;
  /** Version hash rechecked inside the transaction to close the preflight/commit race. */
  readonly expectedVersionHash?: string;
  readonly assertPublishEligible?: (
    version: CalculatorVersionModelDocument,
    session: ClientSession,
  ) => void | Promise<void>;
  /** Optional audit event persisted in the same transaction as publication. */
  readonly audit?: {
    readonly actorId?: mongoose.Types.ObjectId;
    readonly action?: string;
    readonly diffSummary?: Record<string, unknown>;
  };
  readonly now?: Date;
}

/**
 * Atomically promotes an approved version and its calculator pointer. Clinical and
 * publish eligibility validation remains an explicit caller responsibility (P0A).
 */
export async function publishVersionAtomically(options: PublishVersionOptions) {
  return withTransaction(async (session) => {
    const version = await CalculatorVersionModel.findOne({
      _id: options.versionId,
      calculatorId: options.calculatorId,
    }).session(session);
    if (!version) {
      throw new Error('Calculator version was not found');
    }
    if (
      options.expectedVersionHash !== undefined &&
      version.versionHash !== options.expectedVersionHash
    ) {
      throw new PersistenceConflictError('Calculator version changed before publication.');
    }
    if (version.status !== 'approved') {
      throw new Error(`Only approved versions may be published; received ${version.status}`);
    }
    await options.assertPublishEligible?.(version, session);
    assertVersionTransition(version.status, 'published');

    const now = options.now ?? new Date();
    version.status = 'published';
    version.publishedAt = now;
    version.immutableAt = now;
    await version.save({ session });

    const calculator = await CalculatorModel.findById(options.calculatorId).session(session);
    if (!calculator) {
      throw new Error('Calculator identity was not found');
    }
    if (calculator.currentVersionId && !calculator.currentVersionId.equals(version._id)) {
      const previous = await CalculatorVersionModel.findById(calculator.currentVersionId).session(
        session,
      );
      if (previous?.status === 'published') {
        assertVersionTransition(previous.status, 'retired');
        previous.status = 'retired';
        await previous.save({ session });
      }
    }
    calculator.status = 'published';
    calculator.currentVersionId = version._id;
    await calculator.save({ session });

    if (options.audit) {
      await AuditLogModel.create(
        [
          {
            actorId: options.audit.actorId,
            action: options.audit.action ?? 'calculator.version.publish',
            entityType: 'CalculatorVersion',
            entityId: version._id.toString(),
            diffSummary: options.audit.diffSummary,
          },
        ],
        { session, ordered: true },
      );
    }

    await CacheInvalidationEventModel.create(
      [
        {
          calculatorSlug: version.calculatorSlug,
          calculatorVersionId: version._id,
          reason: 'publish',
          paths: [
            '/calculators',
            `/calculators/${version.calculatorSlug}`,
            '/biomarkers',
            '/sitemap.xml',
          ],
          status: 'pending',
          attempts: 0,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
      { session, ordered: true },
    );

    return version;
  });
}

export interface RollbackVersionOptions {
  readonly calculatorId: mongoose.Types.ObjectId;
  readonly sourceVersionId: mongoose.Types.ObjectId;
  readonly actorId?: mongoose.Types.ObjectId;
  readonly prepare: (input: {
    readonly source: CalculatorVersionModelDocument;
    readonly nextVersion: number;
  }) => {
    readonly payload: Record<string, unknown>;
    readonly sourceHash?: string;
    readonly logicHash?: string;
    readonly contentHash?: string;
    readonly reviewHash?: string;
    readonly versionHash: string;
  };
  readonly assertPublishEligible: (
    payload: Record<string, unknown>,
    source: CalculatorVersionModelDocument,
    session: ClientSession,
  ) => void | Promise<void>;
  readonly now?: Date;
}

/**
 * Creates and immediately publishes a rollback copy in one transaction. The
 * immutable source is never modified; the previous current version is retired.
 */
export async function rollbackVersionAtomically(options: RollbackVersionOptions) {
  return withTransaction(async (session) => {
    const calculator = await CalculatorModel.findById(options.calculatorId).session(session);
    const source = await CalculatorVersionModel.findOne({
      _id: options.sourceVersionId,
      calculatorId: options.calculatorId,
    }).session(session);
    if (!calculator || !source) throw new Error('Rollback source was not found');
    if (source.status !== 'published' && source.status !== 'retired')
      throw new Error('Rollback source must be a published or retired immutable version');
    const latest = await CalculatorVersionModel.findOne({ calculatorId: options.calculatorId })
      .sort({ version: -1 })
      .session(session);
    const nextVersion = (latest?.version ?? 0) + 1;
    const prepared = options.prepare({ source, nextVersion });
    await options.assertPublishEligible(prepared.payload, source, session);
    const now = options.now ?? new Date();
    const version = new CalculatorVersionModel({
      calculatorId: calculator._id,
      calculatorSlug: calculator.slug,
      version: nextVersion,
      status: 'published',
      engineSemanticVersion: source.engineSemanticVersion,
      payload: prepared.payload,
      measurementRevisionIds: source.measurementRevisionIds,
      measurementSnapshots: source.measurementSnapshots,
      sourceHash: prepared.sourceHash,
      logicHash: prepared.logicHash,
      contentHash: prepared.contentHash,
      reviewHash: prepared.reviewHash,
      versionHash: prepared.versionHash,
      createdBy: options.actorId,
      lastEditedBy: source.lastEditedBy,
      approvedBy: source.approvedBy,
      approvedAt: source.approvedAt,
      reviewEvidence: source.reviewEvidence,
      publishedAt: now,
      immutableAt: now,
    });
    await version.save({ session });

    if (calculator.currentVersionId && !calculator.currentVersionId.equals(version._id)) {
      const previous = await CalculatorVersionModel.findById(calculator.currentVersionId).session(
        session,
      );
      if (previous?.status === 'published') {
        previous.status = 'retired';
        await previous.save({ session });
      }
    }
    calculator.status = 'published';
    calculator.currentVersionId = version._id;
    calculator.draftVersionId = undefined;
    await calculator.save({ session });

    await AuditLogModel.create(
      [
        {
          actorId: options.actorId,
          action: 'calculator.version.rollback',
          entityType: 'CalculatorVersion',
          entityId: version._id.toString(),
          diffSummary: { sourceVersion: source.version, version: nextVersion },
        },
        {
          actorId: options.actorId,
          action: 'calculator.version.publish.rollback',
          entityType: 'CalculatorVersion',
          entityId: version._id.toString(),
          diffSummary: { sourceVersion: source.version, version: nextVersion },
        },
      ],
      { session, ordered: true },
    );
    await CacheInvalidationEventModel.create(
      [
        {
          calculatorSlug: calculator.slug,
          calculatorVersionId: version._id,
          reason: 'publish',
          paths: ['/calculators', `/calculators/${calculator.slug}`, '/biomarkers', '/sitemap.xml'],
          status: 'pending',
          attempts: 0,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
      { session, ordered: true },
    );
    return version;
  });
}

export interface RetireVersionOptions {
  readonly calculatorId: mongoose.Types.ObjectId;
  readonly versionId: mongoose.Types.ObjectId;
  readonly actorId?: mongoose.Types.ObjectId;
  readonly now?: Date;
}

export async function retireVersionAtomically(options: RetireVersionOptions) {
  return withTransaction(async (session) => {
    const version = await CalculatorVersionModel.findOne({
      _id: options.versionId,
      calculatorId: options.calculatorId,
    }).session(session);
    const calculator = await CalculatorModel.findById(options.calculatorId).session(session);
    if (!version || !calculator) throw new Error('Calculator version was not found');
    assertVersionTransition(version.status, 'retired');
    const now = options.now ?? new Date();
    version.status = 'retired';
    await version.save({ session });
    if (calculator.currentVersionId?.equals(version._id)) {
      calculator.currentVersionId = undefined;
      calculator.status = 'retired';
      await calculator.save({ session });
    }
    await AuditLogModel.create(
      [
        {
          actorId: options.actorId,
          action: 'calculator.version.retire',
          entityType: 'CalculatorVersion',
          entityId: version._id.toString(),
          diffSummary: { version: version.version },
        },
      ],
      { session, ordered: true },
    );
    await CacheInvalidationEventModel.create(
      [
        {
          calculatorSlug: version.calculatorSlug,
          calculatorVersionId: version._id,
          reason: 'retire',
          paths: ['/calculators', `/calculators/${version.calculatorSlug}`, '/sitemap.xml'],
          status: 'pending',
          attempts: 0,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      ],
      { session, ordered: true },
    );
    return version;
  });
}
