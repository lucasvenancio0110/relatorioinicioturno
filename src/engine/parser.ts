import type { AbsenceRecord, MachineRecord, SectionKey, SectorSnapshot, SetupRecord, Shift } from '../domain/types';
import { canonical, cleanDescription, cleanOperationalText, extractAllTnls, extractSeverity, extractShift, extractTime, isNA, normalizeTnl, stripMarkup, titleCaseName } from './normalize';
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
  if (/AFASTAD|AFASTAMENTO|LICENCA/.test(c)) return { name, type: 'leave', sourceId };
  if (c.includes('FERIAS')) return { name, type: 'vacation', sourceId };
  if (c.includes('ATESTADO')) return { name, type: 'certificate', sourceId };
  if (c.includes('ATRAS')) return { name, type: 'delay', sourceId };
  return { name, type: 'absence', sourceId };
}

function preferDescribedDevelopment(items: MachineRecord[]): MachineRecord[] {
  const described = new Set(items.filter((item) => Boolean(item.description)).map((item) => item.tnl));
  return items.filter((item) => item.description || !described.has(item.tnl));
}

function isActiveSetupText(value: string): boolean {
  const c = canonical(value);
  return /EM SETUP|SETUP EM ANDAMENTO|MAQUINA EM SETUP|SETUP\s*\/|INICIAR(?: SETUP)?|INICIANDO|INICIADO|AGUARDANDO SETUP/.test(c);
}

function isDeferredSetupText(value: string): boolean {
  const c = canonical(value);
  return /APOS(?: A)? MANUTENCAO|APOS MANUT|DEPOIS DA MANUTENCAO|AGUARDANDO MANUTENCAO|LIBERAR APOS MANUTENCAO/.test(c);
}

export function parseSector(raw: string, currentShift: Shift = 2, selectedNextShift?: Shift): SectorSnapshot {
  const messages = splitMessages(raw);
  const targetNextShift = selectedNextShift && selectedNextShift !== currentShift ? selectedNextShift : nextShift(currentShift);
  const snapshot: SectorSnapshot = {
    currentShift,
    nextShift: targetNextShift,
    messages,
    maintenanceStopped: [],
    maintenanceProducing: [],
    maintenanceStoppedNotes: [],
    maintenanceProducingNotes: [],
    setups: [],
    upcomingSetups: [],
    nextShiftSetups: [],
    adjustments: [],
    selections: [],
    development: [],
    developmentNotes: [],
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
        const active = isActiveSetupText(line);
        const deferred = isDeferredSetupText(line);

        if (explicitShift === targetNextShift && !active && !deferred) {
          const setup = makeSetup(line, message.id, targetNextShift, 'scheduled');
          if (setup) snapshot.nextShiftSetups.push(setup);
        } else if (deferred || time || section === 'nextSetups' || (explicitShift && explicitShift === currentShift && !active)) {
          const setup = makeSetup(line, message.id, explicitShift || currentShift, 'scheduled');
          if (setup) snapshot.upcomingSetups.push(setup);
        } else {
          const setup = makeSetup(line, message.id, currentShift, 'active');
          if (setup) snapshot.setups.push(setup);
        }
        continue;
      }

      if (section === 'maintenance') {
        const producing = /PRODUZINDO|RODANDO|EM PRODUCAO/.test(canonical(line));
        const item = makeMachine(line, message.id);
        if (item) {
          if (producing) snapshot.maintenanceProducing.push(item);
          else snapshot.maintenanceStopped.push(item);
        } else {
          const note = cleanOperationalText(line);
          if (!note) continue;
          if (producing) snapshot.maintenanceProducingNotes.push(note);
          else snapshot.maintenanceStoppedNotes.push(note);
        }
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
        if (item) snapshot.development.push(item);
        else {
          const note = cleanOperationalText(line.replace(/^DESENVOLVIMENTO\s*:/i, ''));
          if (note) snapshot.developmentNotes.push(note);
        }
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

      if (section === 'observations') {
        const observation = cleanOperationalText(line);
        const c = canonical(observation);
        if (observation && c !== 'MENSAGEM EDITADA' && !c.includes('BOA TARDE') && !c.includes('INICIO DE TURNO') && !/^LINHA\b/.test(c) && !/^CELULA\b/.test(c)) {
          snapshot.observations.push(observation);
        }
      }
    }
  }

  snapshot.maintenanceStopped = uniqueMachines(snapshot.maintenanceStopped);
  snapshot.maintenanceProducing = uniqueMachines(snapshot.maintenanceProducing);
  snapshot.maintenanceStoppedNotes = uniqueStrings(snapshot.maintenanceStoppedNotes);
  snapshot.maintenanceProducingNotes = uniqueStrings(snapshot.maintenanceProducingNotes);
  snapshot.setups = uniqueMachines(snapshot.setups) as SetupRecord[];
  snapshot.upcomingSetups = uniqueMachines(snapshot.upcomingSetups) as SetupRecord[];
  snapshot.nextShiftSetups = uniqueMachines(snapshot.nextShiftSetups) as SetupRecord[];
  snapshot.adjustments = uniqueMachines(snapshot.adjustments);
  snapshot.selections = uniqueMachines(snapshot.selections);
  snapshot.development = preferDescribedDevelopment(uniqueMachines(snapshot.development));
  snapshot.developmentNotes = uniqueStrings(snapshot.developmentNotes);
  snapshot.operators4 = uniqueStrings(snapshot.operators4);
  snapshot.observations = uniqueStrings(snapshot.observations);
  snapshot.review = uniqueStrings(snapshot.review);
  snapshot.absences = [...new Map(snapshot.absences.map((item) => [`${canonical(item.name)}|${item.type}`, item])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return snapshot;
}
