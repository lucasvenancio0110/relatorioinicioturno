export type Shift = 1 | 2 | 3;
export type Severity = 'red' | 'blue' | 'green' | null;

export type SectionKey =
  | 'preparation'
  | 'nextSetups'
  | 'adjustment'
  | 'selection'
  | 'maintenance'
  | 'development'
  | 'absence'
  | 'operator4'
  | 'observations';

export interface SourceMessage {
  id: string;
  sender?: string;
  timestamp?: string;
  line?: string;
  raw: string;
  body: string;
}

export interface MachineRecord {
  tnl: string;
  description?: string;
  severity?: Severity;
  sourceId?: string;
}

export interface SetupRecord extends MachineRecord {
  shift: Shift;
  status: 'active' | 'scheduled';
  time?: string;
}

export interface AbsenceRecord {
  name: string;
  type: 'delay' | 'vacation' | 'absence' | 'certificate' | 'leave';
  sourceId?: string;
}

export interface ManualCounters {
  checkpoint: number;
  /** @deprecated kept only for backwards-compatible localStorage payloads */
  cqMachining: number;
  cqClosing: number;
  cqReinspection: number;
  selectionShift1: number;
  selectionShift2: number;
  selectionShift3: number;
  selectionAll: number;
  selectionTnc: number;
}

export interface SectorSnapshot {
  currentShift: Shift;
  nextShift: Shift;
  messages: SourceMessage[];
  maintenanceStopped: MachineRecord[];
  maintenanceProducing: MachineRecord[];
  maintenanceStoppedNotes: string[];
  maintenanceProducingNotes: string[];
  setups: SetupRecord[];
  upcomingSetups: SetupRecord[];
  nextShiftSetups: SetupRecord[];
  adjustments: MachineRecord[];
  selections: MachineRecord[];
  development: MachineRecord[];
  developmentNotes: string[];
  absences: AbsenceRecord[];
  operators4: string[];
  observations: string[];
  review: string[];
}

export type AuditIssueKind = 'missing-machine' | 'contradiction' | 'parser-review';

export interface AuditIssue {
  id: string;
  kind: AuditIssueKind;
  severity: 'warning' | 'critical';
  message: string;
  tnl?: string;
  sourceIds?: string[];
}

export interface OperationalAttentionContext {
  key: string;
  label: string;
  detail?: string;
  sourceIds: string[];
}

export type OperationalAttentionKind = 'valid-overlap' | 'multi-context';

export interface OperationalAttention {
  id: string;
  kind: OperationalAttentionKind;
  severity: 'info' | 'warning';
  tnl: string;
  title: string;
  message: string;
  contexts: OperationalAttentionContext[];
  sourceIds: string[];
}

export type AssistedValidationKind =
  | 'setup-severity'
  | 'setup-state'
  | 'setup-time'
  | 'maintenance-detail'
  | 'adjustment-detail'
  | 'development-detail'
  | 'absence-type'
  | 'na-with-data';

export interface AssistedValidation {
  id: string;
  kind: AssistedValidationKind;
  severity: 'warning' | 'info';
  title: string;
  message: string;
  question: string;
  interpretedAs: string;
  missingFields: string[];
  sourceId: string;
  sourceLine: string;
  section: SectionKey;
  tnl?: string;
  person?: string;
}

export interface AuditSummary {
  messages: number;
  lines: number;
  machines: number;
  sourceMachines: number;
  review: number;
  confidence: number;
  missingMachines: string[];
  contradictions: number;
  overlaps: number;
  attentionCount: number;
  issues: AuditIssue[];
  attentions: OperationalAttention[];
}
