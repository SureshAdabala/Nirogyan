'use client';

import type { AdminCalculatorVersion } from '@niro/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AdminApiError, saveCalculatorVersion } from '../api';
import { measurementIdsFromPayload } from './draft-template';

type JsonRecord = Record<string, unknown>;
export type StudioSaveState = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error' | 'readonly';

export function useStudioDraft(initial: AdminCalculatorVersion, initialEtag: string) {
  const [version, setVersion] = useState(initial);
  const [draft, setDraftState] = useState<JsonRecord>({ ...initial.payload });
  const [etag, setEtag] = useState(initialEtag);
  const [saveState, setSaveState] = useState<StudioSaveState>(
    initial.status === 'draft' ? 'saved' : 'readonly',
  );
  const [saveError, setSaveError] = useState<string>();
  const revision = useRef(0);
  const savedRevision = useRef(0);
  const saving = useRef(false);
  const queued = useRef(false);
  const etagRef = useRef(initialEtag);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    etagRef.current = etag;
  }, [etag]);

  const flush = useCallback(async (): Promise<string | undefined> => {
    if (version.status !== 'draft') return etagRef.current;
    if (saveState === 'conflict') return undefined;
    if (saving.current) {
      queued.current = true;
      return undefined;
    }
    if (savedRevision.current === revision.current) return etagRef.current;
    if (!etagRef.current) {
      setSaveState('error');
      setSaveError('The server did not provide an ETag. Reload before editing.');
      return undefined;
    }

    const savingRevision = revision.current;
    const payload = draftRef.current;
    let failedWithConflict = false;
    saving.current = true;
    queued.current = false;
    setSaveState('saving');
    setSaveError(undefined);
    try {
      const response = await saveCalculatorVersion(
        version.calculatorSlug,
        version.version,
        { payload, measurementRevisionIds: measurementIdsFromPayload(payload) },
        etagRef.current,
      );
      if (!response.etag) throw new Error('Autosave response did not expose an ETag.');
      setVersion(response.data);
      setEtag(response.etag);
      etagRef.current = response.etag;
      savedRevision.current = savingRevision;
      setSaveState(revision.current === savingRevision ? 'saved' : 'dirty');
      return revision.current === savingRevision ? response.etag : undefined;
    } catch (cause) {
      if (cause instanceof AdminApiError && cause.status === 409) {
        failedWithConflict = true;
        setSaveState('conflict');
        setSaveError('This draft changed elsewhere. Reload it before making more edits.');
      } else {
        setSaveState('error');
        setSaveError(cause instanceof Error ? cause.message : 'Autosave failed.');
      }
      return undefined;
    } finally {
      saving.current = false;
      if (queued.current && !failedWithConflict) void flush();
    }
  }, [saveState, version.calculatorSlug, version.status, version.version]);

  useEffect(() => {
    if (version.status !== 'draft' || saveState !== 'dirty') return;
    const timer = window.setTimeout(() => void flush(), 900);
    return () => window.clearTimeout(timer);
  }, [draft, flush, saveState, version.status]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (savedRevision.current === revision.current) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);

  const setDraft = useCallback(
    (value: JsonRecord | ((current: JsonRecord) => JsonRecord)) => {
      if (version.status !== 'draft' || saveState === 'conflict') return;
      revision.current += 1;
      setDraftState((current) => {
        const next = typeof value === 'function' ? value(current) : value;
        draftRef.current = next;
        return next;
      });
      setSaveState('dirty');
      setSaveError(undefined);
    },
    [saveState, version.status],
  );

  const acceptServerVersion = useCallback((next: AdminCalculatorVersion, nextEtag?: string) => {
    setVersion(next);
    setDraftState({ ...next.payload });
    draftRef.current = { ...next.payload };
    if (nextEtag) {
      setEtag(nextEtag);
      etagRef.current = nextEtag;
    }
    revision.current += 1;
    savedRevision.current = revision.current;
    setSaveState(next.status === 'draft' ? 'saved' : 'readonly');
    setSaveError(undefined);
  }, []);

  return {
    version,
    draft,
    etag,
    saveState,
    saveError,
    setDraft,
    flush,
    acceptServerVersion,
  };
}
