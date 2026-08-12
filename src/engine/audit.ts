import type { AuditSummary, SectorSnapshot } from '../domain/types';

export function auditSnapshot(snapshot: SectorSnapshot): AuditSummary {
  const machines = new Set<string>();
  [snapshot.maintenanceStopped, snapshot.maintenanceProducing, snapshot.setups, snapshot.upcomingSetups, snapshot.nextShiftSetups, snapshot.adjustments, snapshot.selections, snapshot.development]
    .flat()
    .forEach((item) => machines.add(item.tnl));

  const lineSet = new Set(snapshot.messages.map((message) => message.line).filter(Boolean));
  const penalties = Math.min(45, snapshot.review.length * 8);
  return {
    messages: snapshot.messages.length,
    lines: lineSet.size,
    machines: machines.size,
    review: snapshot.review.length,
    confidence: Math.max(55, 100 - penalties),
  };
}
