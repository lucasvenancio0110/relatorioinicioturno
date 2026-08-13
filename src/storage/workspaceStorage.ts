import type { ManualCounters, SectorSnapshot, Shift } from '../domain/types';
import type { ReportDocumentBlock } from '../engine/reportDocument';

export const WORKSPACE_STORAGE_KEY = 'relatorio-inicio-turno:workspace:v1';
export const REPORT_WORKSPACE_STORAGE_KEY = 'relatorio-inicio-turno:report-workspace:v1';

export interface PersistedWorkspace {
  version: 1;
  savedAt: string;
  raw: string;
  analyzedRaw: string;
  shift: Shift;
  selectedNextShift: Shift;
  snapshot: SectorSnapshot | null;
  counters: ManualCounters;
  validatedAttentionIds: string[];
  validatedInterpretationIds?: string[];
  analysisVersion: number;
}

export interface PersistedReportWorkspace {
  version: 1;
  savedAt: string;
  revision: number;
  sourceFullReport: string;
  sourceCompactReport: string;
  tab: 'full' | 'compact';
  fullBlocks: ReportDocumentBlock[];
  compactBlocks: ReportDocumentBlock[];
  fullDirty: boolean;
  compactDirty: boolean;
}

type WorkspaceInput = Omit<PersistedWorkspace, 'version' | 'savedAt'>;
type ReportWorkspaceInput = Omit<PersistedReportWorkspace, 'version' | 'savedAt'>;

const isShift = (value: unknown): value is Shift => value === 1 || value === 2 || value === 3;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function parsePersistedWorkspace(serialized: string | null): PersistedWorkspace | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isObject(value) || value.version !== 1) return null;
    if (!isShift(value.shift) || !isShift(value.selectedNextShift) || value.shift === value.selectedNextShift) return null;
    if (typeof value.raw !== 'string' || typeof value.analyzedRaw !== 'string') return null;
    if (!isObject(value.counters) || !Array.isArray(value.validatedAttentionIds)) return null;
    if (value.validatedInterpretationIds !== undefined && !Array.isArray(value.validatedInterpretationIds)) return null;
    if (typeof value.analysisVersion !== 'number' || !Number.isFinite(value.analysisVersion)) return null;
    if (typeof value.savedAt !== 'string') return null;
    if (value.snapshot !== null && !isObject(value.snapshot)) return null;
    return value as unknown as PersistedWorkspace;
  } catch {
    return null;
  }
}

export function readWorkspace(): PersistedWorkspace | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return parsePersistedWorkspace(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
}

export function saveWorkspace(input: WorkspaceInput): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const savedAt = new Date().toISOString();
    const payload: PersistedWorkspace = { version: 1, savedAt, ...input };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearWorkspace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Safari private mode / storage restrictions: clearing is best effort.
  }
}

export function parsePersistedReportWorkspace(
  serialized: string | null,
  revision: number,
  sourceFullReport: string,
  sourceCompactReport: string,
): PersistedReportWorkspace | null {
  if (!serialized) return null;
  try {
    const value: unknown = JSON.parse(serialized);
    if (!isObject(value) || value.version !== 1 || value.revision !== revision) return null;
    if (value.sourceFullReport !== sourceFullReport || value.sourceCompactReport !== sourceCompactReport) return null;
    if (value.tab !== 'full' && value.tab !== 'compact') return null;
    if (!Array.isArray(value.fullBlocks) || !Array.isArray(value.compactBlocks)) return null;
    if (typeof value.fullDirty !== 'boolean' || typeof value.compactDirty !== 'boolean' || typeof value.savedAt !== 'string') return null;
    return value as unknown as PersistedReportWorkspace;
  } catch {
    return null;
  }
}

export function readReportWorkspace(
  revision: number,
  sourceFullReport: string,
  sourceCompactReport: string,
): PersistedReportWorkspace | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return parsePersistedReportWorkspace(
    window.localStorage.getItem(REPORT_WORKSPACE_STORAGE_KEY),
    revision,
    sourceFullReport,
    sourceCompactReport,
  );
}

export function saveReportWorkspace(input: ReportWorkspaceInput): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const savedAt = new Date().toISOString();
    const payload: PersistedReportWorkspace = { version: 1, savedAt, ...input };
    window.localStorage.setItem(REPORT_WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearReportWorkspace(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(REPORT_WORKSPACE_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}
