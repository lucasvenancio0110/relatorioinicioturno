import type {
  MachineRecord,
  OperationalAttention,
  OperationalAttentionContext,
  SectorSnapshot,
  SetupRecord,
} from '../domain/types';

interface ContextDefinition {
  key: string;
  label: string;
  records: MachineRecord[];
  formatDetail?: (record: MachineRecord) => string | undefined;
}

const setupDetail = (record: MachineRecord): string | undefined => {
  const setup = record as SetupRecord;
  const parts: string[] = [];
  if (setup.status === 'active') parts.push('Em setup');
  else parts.push(`Setup ${setup.shift}ºT`);
  if (setup.time) parts.push(setup.time);
  if (setup.description) parts.push(setup.description);
  return parts.join(' · ') || undefined;
};

const machineDetail = (record: MachineRecord): string | undefined => record.description || undefined;

function contextDefinitions(snapshot: SectorSnapshot): ContextDefinition[] {
  return [
    { key: 'maintenance-stopped', label: 'Manutenção parada', records: snapshot.maintenanceStopped, formatDetail: machineDetail },
    { key: 'maintenance-producing', label: 'Manutenção produzindo', records: snapshot.maintenanceProducing, formatDetail: machineDetail },
    { key: 'setup-active', label: 'Setup atual', records: snapshot.setups, formatDetail: setupDetail },
    { key: 'setup-upcoming', label: 'Próximo setup', records: snapshot.upcomingSetups, formatDetail: setupDetail },
    { key: 'setup-next-shift', label: `Setup ${snapshot.nextShift}ºT`, records: snapshot.nextShiftSetups, formatDetail: setupDetail },
    { key: 'adjustment', label: 'Ajuste', records: snapshot.adjustments, formatDetail: machineDetail },
    { key: 'selection', label: 'Seleção de ordem', records: snapshot.selections, formatDetail: machineDetail },
    { key: 'development', label: 'Desenvolvimento', records: snapshot.development, formatDetail: machineDetail },
  ];
}

function contextFor(definition: ContextDefinition, tnl: string): OperationalAttentionContext | null {
  const matches = definition.records.filter((item) => item.tnl === tnl);
  if (!matches.length) return null;

  const details = [...new Set(matches.map((item) => definition.formatDetail?.(item)).filter((value): value is string => Boolean(value)))];
  const sourceIds = [...new Set(matches.map((item) => item.sourceId).filter((value): value is string => Boolean(value)))];

  return {
    key: definition.key,
    label: definition.label,
    detail: details.length ? details.join(' / ') : undefined,
    sourceIds,
  };
}

function isScheduledSetup(contexts: OperationalAttentionContext[]): boolean {
  return contexts.some((context) => context.key === 'setup-upcoming' || context.key === 'setup-next-shift');
}

function buildAttention(tnl: string, contexts: OperationalAttentionContext[]): OperationalAttention {
  const keys = new Set(contexts.map((context) => context.key));
  const sourceIds = [...new Set(contexts.flatMap((context) => context.sourceIds))];
  const inMaintenance = keys.has('maintenance-stopped') || keys.has('maintenance-producing');

  if (inMaintenance && isScheduledSetup(contexts)) {
    return {
      id: `overlap-flow-${tnl}`,
      kind: 'valid-overlap',
      severity: 'info',
      tnl,
      title: 'Manutenção + setup programado',
      message: `${tnl} aparece em manutenção e também com um setup programado. Isso pode ser um fluxo operacional correto, mas vale acompanhar a liberação da máquina antes do setup.`,
      contexts,
      sourceIds,
    };
  }

  if (keys.has('selection') && keys.has('development')) {
    return {
      id: `overlap-selection-development-${tnl}`,
      kind: 'valid-overlap',
      severity: 'info',
      tnl,
      title: 'Seleção + desenvolvimento',
      message: `${tnl} aparece em seleção de ordem e desenvolvimento. As duas informações podem coexistir; o destaque serve para o técnico enxergar que a mesma máquina está em dois contextos.`,
      contexts,
      sourceIds,
    };
  }

  return {
    id: `multi-context-${tnl}`,
    kind: 'multi-context',
    severity: 'warning',
    tnl,
    title: 'Máquina em múltiplos contextos',
    message: `${tnl} aparece em mais de uma situação operacional. Não é necessariamente um erro, mas o técnico deve conferir a sequência e manter essa sobreposição no radar.`,
    contexts,
    sourceIds,
  };
}

export function buildOperationalAttentions(snapshot: SectorSnapshot, conflictingTnls: Set<string> = new Set()): OperationalAttention[] {
  const definitions = contextDefinitions(snapshot);
  const allTnls = new Set(definitions.flatMap((definition) => definition.records.map((item) => item.tnl)));
  const attentions: OperationalAttention[] = [];

  allTnls.forEach((tnl) => {
    if (conflictingTnls.has(tnl)) return;
    const contexts = definitions.map((definition) => contextFor(definition, tnl)).filter((value): value is OperationalAttentionContext => Boolean(value));
    if (contexts.length < 2) return;
    attentions.push(buildAttention(tnl, contexts));
  });

  return attentions.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'warning' ? -1 : 1;
    return Number(a.tnl.replace(/\D/g, '')) - Number(b.tnl.replace(/\D/g, ''));
  });
}
