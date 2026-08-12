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
  type: 'delay' | 'vacation' | 'absence' | 'certificate';
  sourceId?: string;
}

export interface ManualCounters {
  checkpoint: number;
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
  setups: SetupRecord[];
  upcomingSetups: SetupRecord[];
  nextShiftSetups: SetupRecord[];
  adjustments: MachineRecord[];
  selections: MachineRecord[];
  development: MachineRecord[];
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

export interface AuditSummary {
  messages: number;
  lines: number;
  machines: number;
  sourceMachines: number;
  review: number;
  confidence: number;
  missingMachines: string[];
  contradictions: number;
  issues: AuditIssue[];
}
