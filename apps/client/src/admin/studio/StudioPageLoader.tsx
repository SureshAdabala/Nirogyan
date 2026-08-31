'use client';

import type { AdminCalculatorVersion } from '@niro/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import type { AdminMeasurementRecord } from '../api';
import { biomarkers, calculatorVersion, calculatorVersions } from '../api';
import { StudioWorkspace } from './StudioWorkspace';

interface Props {
  readonly slug: string;
  readonly versionNumber: number;
}

export function StudioPageLoader({ slug, versionNumber }: Props) {
  const [version, setVersion] = useState<AdminCalculatorVersion>();
  const [etag, setEtag] = useState<string>();
  const [history, setHistory] = useState<readonly AdminCalculatorVersion[]>([]);
  const [measurements, setMeasurements] = useState<readonly AdminMeasurementRecord[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistory(await calculatorVersions(slug));
  }, [slug]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [versionResponse, versionHistory, measurementRecords] = await Promise.all([
        calculatorVersion(slug, versionNumber),
        calculatorVersions(slug),
        biomarkers(),
      ]);
      if (!versionResponse.etag)
        throw new Error('The administrative API did not expose the version ETag.');
      setVersion(versionResponse.data);
      setEtag(versionResponse.etag);
      setHistory(versionHistory);
      setMeasurements(measurementRecords);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The Studio workspace could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [slug, versionNumber]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      calculatorVersion(slug, versionNumber),
      calculatorVersions(slug),
      biomarkers(),
    ])
      .then(([versionResponse, versionHistory, measurementRecords]) => {
        if (!versionResponse.etag)
          throw new Error('The administrative API did not expose the version ETag.');
        if (!active) return;
        setVersion(versionResponse.data);
        setEtag(versionResponse.etag);
        setHistory(versionHistory);
        setMeasurements(measurementRecords);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'The Studio workspace could not be loaded.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, versionNumber]);

  if (loading)
    return (
      <main className="admin-loading" id="main-content">
        <p>Loading the versioned workspace…</p>
      </main>
    );
  if (error || !version || !etag)
    return (
      <main className="admin-shell" id="main-content">
        <p className="admin-alert admin-alert--error" role="alert">
          {error ?? 'The calculator version is unavailable.'}
        </p>
        <div className="admin-button-row">
          <button className="admin-secondary-button" onClick={() => void load()} type="button">
            Retry
          </button>
          <Link href="/admin">Return to calculator list</Link>
        </div>
      </main>
    );
  return (
    <StudioWorkspace
      initialEtag={etag}
      initialHistory={history}
      initialVersion={version}
      measurements={measurements}
      reloadHistory={loadHistory}
    />
  );
}
