import type { MachineRecord, OperationalAttention, SectorSnapshot } from '../domain/types';

export interface AttentionDecision {
  selectedContextKeys: string[];
  descriptions?: Record<string, string>;
}

const collectionByContext = (snapshot: SectorSnapshot, contextKey: string): MachineRecord[] => {
  switch (contextKey) {
    case 'maintenance-stopped': return snapshot.maintenanceStopped;
    case 'maintenance-producing': return snapshot.maintenanceProducing;
    case 'setup-active': return snapshot.setups;
    case 'setup-upcoming': return snapshot.upcomingSetups;
    case 'setup-next-shift': return snapshot.nextShiftSetups;
    case 'adjustment': return snapshot.adjustments;
    case 'selection': return snapshot.selections;
    case 'development': return snapshot.development;
    default: return [];
  }
};

const replaceCollection = (snapshot: SectorSnapshot, contextKey: string, records: MachineRecord[]): SectorSnapshot => {
  switch (contextKey) {
    case 'maintenance-stopped': return { ...snapshot, maintenanceStopped: records };
    case 'maintenance-producing': return { ...snapshot, maintenanceProducing: records };
    case 'setup-active': return { ...snapshot, setups: records as SectorSnapshot['setups'] };
    case 'setup-upcoming': return { ...snapshot, upcomingSetups: records as SectorSnapshot['upcomingSetups'] };
    case 'setup-next-shift': return { ...snapshot, nextShiftSetups: records as SectorSnapshot['nextShiftSetups'] };
    case 'adjustment': return { ...snapshot, adjustments: records };
    case 'selection': return { ...snapshot, selections: records };
    case 'development': return { ...snapshot, development: records };
    default: return snapshot;
  }
};

export function getContextDescription(snapshot: SectorSnapshot, contextKey: string, tnl: string): string {
  const match = collectionByContext(snapshot, contextKey).find((record) => record.tnl === tnl);
  return match?.description || '';
}

function updateDescription(snapshot: SectorSnapshot, contextKey: string, tnl: string, description: string): SectorSnapshot {
  const current = collectionByContext(snapshot, contextKey);
  if (!current.length) return snapshot;
  const normalized = description.trim();
  const next = current.map((record) => record.tnl === tnl ? { ...record, description: normalized || undefined } : record);
  return replaceCollection(snapshot, contextKey, next);
}

function removeFromContext(snapshot: SectorSnapshot, contextKey: string, tnl: string): SectorSnapshot {
  const current = collectionByContext(snapshot, contextKey);
  if (!current.length) return snapshot;
  return replaceCollection(snapshot, contextKey, current.filter((record) => record.tnl !== tnl));
}

export function applyAttentionDecision(
  snapshot: SectorSnapshot,
  attention: OperationalAttention,
  decision: AttentionDecision,
): SectorSnapshot {
  const selected = new Set(decision.selectedContextKeys);
  if (!selected.size) return snapshot;

  let next = snapshot;

  attention.contexts.forEach((context) => {
    if (!selected.has(context.key)) {
      next = removeFromContext(next, context.key, attention.tnl);
      return;
    }

    if (decision.descriptions && Object.prototype.hasOwnProperty.call(decision.descriptions, context.key)) {
      next = updateDescription(next, context.key, attention.tnl, decision.descriptions[context.key]);
    }
  });

  return next;
}
