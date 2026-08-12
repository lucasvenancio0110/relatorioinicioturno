import type { AbsenceRecord, MachineRecord, SectionKey, SectorSnapshot, SetupRecord, Shift } from '../domain/types';
import { canonical, cleanDescription, extractAllTnls, extractSeverity, extractShift, extractTime, isNA, normalizeTnl, stripMarkup, titleCaseName } from './normalize';
import { splitMessages } from './messages';
import { detectSection, isAdministrativeLine } from './sections';

const nextShift = (shift: Shift): Shift => (shift === 3 ? 1 : ((shift + 1) as Shift));

const uniqueMachines = <T extends MachineRecord>(items: T[]): T[] => {
  const seen = new Set<string>();
  return [...items]
    .sort((a, b) => Number(a.tnl.replace(/\D/g, '')) - Number(b.tnl.replace(/\D/g, '')))
    .filter((item) => {
      const key = `${item.tnl}|${canonical(item.description || '')}|${item.severity || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const uniqueStrings = (items: string[]): string[] => [...new Map(items.filter(Boolean).map((item) => [canonical(item), item])).values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));

function makeMachine(line: string, sourceId: string): MachineRecord | null {
  const tnl = normalizeTnl(line);
  if (!tnl) return null;
  return { tnl, description: cleanDescription(line) || undefined, sourceId };
}

function makeSetup(line: string, sourceId: string, shift: Shift, status: SetupRecord['status']): SetupRecord | null {
  const tnl = normalizeTnl(line);
  if (!tnl) return null;
  return {
    tnl,
    description: cleanDescription(line) || undefined,
    severity: extractSeverity(line),
    sourceId,
    shift,
    status,
    time: extractTime(line) || undefined,
  };
}

function parseAbsence(line: string, sourceId: string): AbsenceRecord | null {
  const c = canonical(line);
  const name = titleCaseName(line);
  if (!name || isNA(line)) return null;
  if (c.includes('FERIAS')) return { name, type: 'vacation', sourceId };
  if (c.includes('ATESTADO')) return { name, type: 'certificate', sourceId };
  if (c.includes('ATRAS')) return { name, type: 'delay', sourceId };
  return { name, type: 'absence', sourceId };
}

export function parseSector(raw: string, currentShift: Shift = 2): SectorSnapshot {
  const messages = splitMessages(raw);
  const targetNextShift = nextShift(currentShift);
  const snapshot: SectorSnapshot = {
    currentShift,
    nextShift: targetNextShift,
    messages,
    maintenanceStopped: [],
    maintenanceProducing: [],
    setups: [],
    upcomingSetups: [],
    nextShiftSetups: [],
    adjustments: [],
    selections: [],
    development: [],
    absences: [],
    operators4: [],
    observations: [],
    review: [],
  };

  for (const message of messages) {
    let section: SectionKey | null = null;
    for (const rawLine of message.body.split('\n')) {
      const line = stripMarkup(rawLine);
      if (!line) continue;
      const detected = detectSection(line);
      if (detected) { section = detected; continue; }
      if (isAdministrativeLine(line) || isNA(line) || !section) continue;

      if (section === 'preparation' || section === 'nextSetups') {
        const tnl = normalizeTnl(line);
        if (!tnl) { snapshot.review.push(`Setup sem TNL clara: ${line}`); continue; }
        const explicitShift = extractShift(line);
        const time = extractTime(line);
        const c = canonical(line);
        const active = /EM SETUP|INICIAR|INICIANDO|INICIADO|APOS MANUTENCAO/.test(c);

        if (explicitShift === targetNextShift) {
          const setup = makeSetup(line, message.id, targetNextShift, 'scheduled');
          if (setup) snapshot.nextShiftSetups.push(setup);
        } else if (time || section === 'nextSetups' || (explicitShift && explicitShift === currentShift && !active)) {
          const setup = makeSetup(line, message.id, explicitShift || currentShift, 'scheduled');
          if (setup) snapshot.upcomingSetups.push(setup);
        } else {
          const setup = makeSetup(line, message.id, currentShift, 'active');
          if (setup) snapshot.setups.push(setup);
        }
        continue;
      }

      if (section === 'maintenance') {
        const item = makeMachine(line, message.id);
        if (!item) { snapshot.review.push(`Manutenção sem TNL clara: ${line}`); continue; }
        if (/PRODUZINDO|RODANDO|EM PRODUCAO/.test(canonical(line))) snapshot.maintenanceProducing.push(item);
        else snapshot.maintenanceStopped.push(item);
        continue;
      }

      if (section === 'adjustment') {
        const tnls = extractAllTnls(line);
        if (!tnls.length) { snapshot.review.push(`Ajuste sem TNL clara: ${line}`); continue; }
        const description = cleanDescription(line) || undefined;
        tnls.forEach((tnl) => snapshot.adjustments.push({ tnl, description, sourceId: message.id }));
        continue;
      }

      if (section === 'selection') {
        const tnls = extractAllTnls(line);
        if (!tnls.length) { snapshot.review.push(`Seleção sem TNL clara: ${line}`); continue; }
        tnls.forEach((tnl) => snapshot.selections.push({ tnl, sourceId: message.id }));
        continue;
      }

      if (section === 'development') {
        const item = makeMachine(line, message.id);
        if (!item) { snapshot.review.push(`Desenvolvimento sem TNL clara: ${line}`); continue; }
        snapshot.development.push(item);
        continue;
      }

      if (section === 'absence') {
        const absence = parseAbsence(line, message.id);
        if (absence) snapshot.absences.push(absence);
        continue;
      }

      if (section === 'operator4') {
        const name = titleCaseName(line);
        if (name) snapshot.operators4.push(name);
        continue;
      }

      if (section === 'observations') snapshot.observations.push(line);
    }
  }

  snapshot.maintenanceStopped = uniqueMachines(snapshot.maintenanceStopped);
  snapshot.maintenanceProducing = uniqueMachines(snapshot.maintenanceProducing);
  snapshot.setups = uniqueMachines(snapshot.setups) as SetupRecord[];
  snapshot.upcomingSetups = uniqueMachines(snapshot.upcomingSetups) as SetupRecord[];
  snapshot.nextShiftSetups = uniqueMachines(snapshot.nextShiftSetups) as SetupRecord[];
  snapshot.adjustments = uniqueMachines(snapshot.adjustments);
  snapshot.selections = uniqueMachines(snapshot.selections);
  snapshot.development = uniqueMachines(snapshot.development);
  snapshot.operators4 = uniqueStrings(snapshot.operators4);
  snapshot.observations = uniqueStrings(snapshot.observations);
  snapshot.review = uniqueStrings(snapshot.review);
  snapshot.absences = [...new Map(snapshot.absences.map((item) => [`${canonical(item.name)}|${item.type}`, item])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return snapshot;
}
