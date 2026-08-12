import type { AbsenceRecord, AuditIssue, AuditSummary, MachineRecord, SectionKey, SectorSnapshot } from '../domain/types';
import { canonical, extractAllTnls, isNA, stripMarkup } from './normalize';
import { detectSection, isAdministrativeLine } from './sections';

const machineCollections = (snapshot: SectorSnapshot): MachineRecord[][] => [
  snapshot.maintenanceStopped,
  snapshot.maintenanceProducing,
  snapshot.setups,
  snapshot.upcomingSetups,
  snapshot.nextShiftSetups,
  snapshot.adjustments,
  snapshot.selections,
  snapshot.development,
];

const auditedSections = new Set<SectionKey>([
  'preparation',
  'nextSetups',
  'adjustment',
  'selection',
  'maintenance',
  'development',
  'observations',
]);

function sourceTnls(snapshot: SectorSnapshot): Set<string> {
  const machines = new Set<string>();

  snapshot.messages.forEach((message) => {
    let section: SectionKey | null = null;

    message.body.split('\n').forEach((rawLine) => {
      const line = stripMarkup(rawLine);
      if (!line) return;

      const detected = detectSection(line);
      if (detected) {
        section = detected;
        return;
      }

      if (!section || !auditedSections.has(section) || isAdministrativeLine(line) || isNA(line)) return;
      extractAllTnls(line).forEach((tnl) => machines.add(tnl));
    });
  });

  return machines;
}

function outputTnls(snapshot: SectorSnapshot): Set<string> {
  const machines = new Set<string>();
  machineCollections(snapshot).flat().forEach((item) => machines.add(item.tnl));
  snapshot.observations.forEach((line) => extractAllTnls(line).forEach((tnl) => machines.add(tnl)));
  return machines;
}

function sourceIdsFor(items: MachineRecord[], tnl: string): string[] {
  return [...new Set(items.filter((item) => item.tnl === tnl).map((item) => item.sourceId).filter((id): id is string => Boolean(id)))];
}

function rawSourceIdsForTnl(snapshot: SectorSnapshot, targetTnl: string): string[] {
  const ids = new Set<string>();

  snapshot.messages.forEach((message) => {
    let section: SectionKey | null = null;
    message.body.split('\n').forEach((rawLine) => {
      const line = stripMarkup(rawLine);
      if (!line) return;
      const detected = detectSection(line);
      if (detected) { section = detected; return; }
      if (!section || !auditedSections.has(section) || isAdministrativeLine(line) || isNA(line)) return;
      if (extractAllTnls(line).includes(targetTnl)) ids.add(message.id);
    });
  });

  return [...ids];
}

function maintenanceContradictions(snapshot: SectorSnapshot): AuditIssue[] {
  const stopped = new Set(snapshot.maintenanceStopped.map((item) => item.tnl));
  const producing = new Set(snapshot.maintenanceProducing.map((item) => item.tnl));

  return [...stopped]
    .filter((tnl) => producing.has(tnl))
    .map((tnl) => ({
      id: `maintenance-state-${tnl}`,
      kind: 'contradiction' as const,
      severity: 'critical' as const,
      tnl,
      sourceIds: [
        ...sourceIdsFor(snapshot.maintenanceStopped, tnl),
        ...sourceIdsFor(snapshot.maintenanceProducing, tnl),
      ],
      message: `${tnl} aparece ao mesmo tempo como manutenção parada e manutenção produzindo. Os dois estados não podem ser verdadeiros no mesmo momento.`,
    }));
}

function setupMaintenanceContradictions(snapshot: SectorSnapshot): AuditIssue[] {
  const stopped = new Set(snapshot.maintenanceStopped.map((item) => item.tnl));
  const activeSetups = new Set(snapshot.setups.map((item) => item.tnl));

  return [...stopped]
    .filter((tnl) => activeSetups.has(tnl))
    .map((tnl) => ({
      id: `setup-maintenance-${tnl}`,
      kind: 'contradiction' as const,
      severity: 'critical' as const,
      tnl,
      sourceIds: [
        ...sourceIdsFor(snapshot.maintenanceStopped, tnl),
        ...sourceIdsFor(snapshot.setups, tnl),
      ],
      message: `${tnl} aparece como setup ativo e manutenção parada ao mesmo tempo. Confirme se a máquina já saiu da manutenção ou se o setup ainda não começou.`,
    }));
}

function absenceContradictions(absences: AbsenceRecord[]): AuditIssue[] {
  const byName = new Map<string, AbsenceRecord[]>();
  absences.forEach((absence) => {
    const key = canonical(absence.name);
    byName.set(key, [...(byName.get(key) || []), absence]);
  });

  const issues: AuditIssue[] = [];
  byName.forEach((items, key) => {
    const types = new Set(items.map((item) => item.type));
    if (types.size <= 1) return;
    issues.push({
      id: `absence-state-${key}`,
      kind: 'contradiction',
      severity: 'warning',
      sourceIds: [...new Set(items.map((item) => item.sourceId).filter((id): id is string => Boolean(id)))],
      message: `${items[0].name} aparece com mais de uma classificação de ausência. Confirme qual situação deve constar no relatório.`,
    });
  });
  return issues;
}

export function auditSnapshot(snapshot: SectorSnapshot): AuditSummary {
  const parsedMachines = outputTnls(snapshot);
  const rawMachines = sourceTnls(snapshot);
  const missingMachines = [...rawMachines].filter((tnl) => !parsedMachines.has(tnl)).sort();

  const issues: AuditIssue[] = [
    ...snapshot.review.map((message, index) => ({
      id: `parser-${index + 1}`,
      kind: 'parser-review' as const,
      severity: 'warning' as const,
      message,
    })),
    ...missingMachines.map((tnl) => ({
      id: `missing-${tnl}`,
      kind: 'missing-machine' as const,
      severity: 'critical' as const,
      tnl,
      sourceIds: rawSourceIdsForTnl(snapshot, tnl),
      message: `${tnl} foi identificada no texto bruto, mas não chegou ao modelo consolidado. Confirme a situação antes de finalizar o relatório.`,
    })),
    ...maintenanceContradictions(snapshot),
    ...setupMaintenanceContradictions(snapshot),
    ...absenceContradictions(snapshot.absences),
  ];

  const lineSet = new Set(snapshot.messages.map((message) => message.line).filter(Boolean));
  const contradictionCount = issues.filter((issue) => issue.kind === 'contradiction').length;
  const coverage = rawMachines.size ? (rawMachines.size - missingMachines.length) / rawMachines.size : 1;
  const issuePenalty = issues.reduce((total, issue) => total + (issue.severity === 'critical' ? 12 : 4), 0);
  const confidence = Math.max(0, Math.min(100, Math.round(coverage * 100 - issuePenalty)));

  return {
    messages: snapshot.messages.length,
    lines: lineSet.size,
    machines: parsedMachines.size,
    sourceMachines: rawMachines.size,
    review: issues.length,
    confidence,
    missingMachines,
    contradictions: contradictionCount,
    issues,
  };
}
