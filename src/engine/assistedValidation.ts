import type {
  AbsenceRecord,
  AssistedValidation,
  MachineRecord,
  SectionKey,
  SectorSnapshot,
  SetupRecord,
  Severity,
} from '../domain/types';
import {
  canonical,
  cleanDescription,
  extractSeverity,
  extractShift,
  extractTime,
  isNA,
  normalizeTnl,
  stripMarkup,
  titleCaseName,
} from './normalize';
import { detectSection, isAdministrativeLine } from './sections';

export interface AssistedValidationDecision {
  severity?: Exclude<Severity, null>;
  setupPlacement?: 'active' | 'scheduled-current' | 'scheduled-next';
  time?: string;
  description?: string;
  absenceType?: AbsenceRecord['type'];
}

const sectionLabels: Record<SectionKey, string> = {
  preparation: 'Preparação',
  nextSetups: 'Próximos setups',
  adjustment: 'Ajuste',
  selection: 'Seleção de ordens',
  maintenance: 'Manutenção',
  development: 'Desenvolvimento',
  absence: 'Falta/Atraso',
  operator4: 'Operador com 4 máquinas',
  observations: 'Observações',
};

const isActiveSetupText = (value: string): boolean => {
  const c = canonical(value);
  return /EM SETUP|SETUP EM ANDAMENTO|MAQUINA EM SETUP|SETUP\s*\/|INICIAR(?: SETUP)?|INICIANDO|INICIADO|AGUARDANDO SETUP/.test(c);
};

const isDeferredSetupText = (value: string): boolean => {
  const c = canonical(value);
  return /APOS(?: A)? MANUTENCAO|APOS MANUT|DEPOIS DA MANUTENCAO|AGUARDANDO MANUTENCAO|LIBERAR APOS MANUTENCAO/.test(c);
};

const sameSource = (record: MachineRecord, sourceId: string, tnl: string) => record.tnl === tnl && record.sourceId === sourceId;

function setupPlacement(snapshot: SectorSnapshot, sourceId: string, tnl: string): { record?: SetupRecord; label: string; key: 'active' | 'scheduled-current' | 'scheduled-next' } {
  const active = snapshot.setups.find((item) => sameSource(item, sourceId, tnl));
  if (active) return { record: active, label: 'Setup atual', key: 'active' };
  const upcoming = snapshot.upcomingSetups.find((item) => sameSource(item, sourceId, tnl));
  if (upcoming) return { record: upcoming, label: 'Próximo setup', key: 'scheduled-current' };
  const next = snapshot.nextShiftSetups.find((item) => sameSource(item, sourceId, tnl));
  if (next) return { record: next, label: `Setup ${snapshot.nextShift}ºT`, key: 'scheduled-next' };
  return { label: 'Setup', key: 'active' };
}

function currentDescription(items: MachineRecord[], sourceId: string, tnl: string): string {
  return items.find((item) => sameSource(item, sourceId, tnl))?.description || '';
}

function validationId(sourceId: string, section: SectionKey, subject: string, kind: string): string {
  return `assist-${sourceId}-${section}-${subject.replace(/\s+/g, '-').toLowerCase()}-${kind}`;
}

function setupValidations(snapshot: SectorSnapshot, sourceId: string, section: SectionKey, line: string): AssistedValidation[] {
  const tnl = normalizeTnl(line);
  if (!tnl) return [];

  const explicitSeverity = extractSeverity(line);
  const explicitShift = extractShift(line);
  const time = extractTime(line);
  const active = isActiveSetupText(line);
  const deferred = isDeferredSetupText(line);
  const placement = setupPlacement(snapshot, sourceId, tnl);
  const effectiveSeverity = placement.record?.severity || explicitSeverity;
  const results: AssistedValidation[] = [];

  const hasStatusEvidence = active || deferred || Boolean(time) || section === 'nextSetups' || Boolean(explicitShift);

  if (!hasStatusEvidence) {
    const missingFields = ['Situação do setup'];
    if (!effectiveSeverity) missingFields.push('Tipo/cor do setup');
    results.push({
      id: validationId(sourceId, section, tnl, 'setup-state'),
      kind: 'setup-state',
      severity: 'warning',
      title: `${tnl} · preparação incompleta`,
      message: `A linha foi entendida provisoriamente como ${placement.label.toLowerCase()}, mas não informa se o setup está acontecendo agora ou será feito depois.`,
      question: `Confirme a situação da ${tnl}${effectiveSeverity ? '' : ' e o tipo 🔴/🟢/🔵'}.`,
      interpretedAs: placement.label,
      missingFields,
      sourceId,
      sourceLine: line,
      section,
      tnl,
    });
    return results;
  }

  if (!effectiveSeverity) {
    const missingFields = ['Tipo/cor do setup'];
    if (placement.key === 'scheduled-current' && !placement.record?.time && !time && !deferred) missingFields.push('Horário');
    results.push({
      id: validationId(sourceId, section, tnl, 'setup-severity'),
      kind: 'setup-severity',
      severity: 'warning',
      title: `${tnl} · tipo do setup não informado`,
      message: `O motor entendeu ${placement.label.toLowerCase()}, mas o preparador não informou 🔴, 🟢 ou 🔵.`,
      question: `Qual é o tipo do setup da ${tnl}?`,
      interpretedAs: placement.label,
      missingFields,
      sourceId,
      sourceLine: line,
      section,
      tnl,
    });
  } else if (placement.key === 'scheduled-current' && !placement.record?.time && !time && !deferred) {
    results.push({
      id: validationId(sourceId, section, tnl, 'setup-time'),
      kind: 'setup-time',
      severity: 'info',
      title: `${tnl} · horário não informado`,
      message: 'O próximo setup está claro, mas não há horário. Se houver previsão, você pode completar agora.',
      question: `Existe um horário previsto para o setup da ${tnl}?`,
      interpretedAs: placement.label,
      missingFields: ['Horário'],
      sourceId,
      sourceLine: line,
      section,
      tnl,
    });
  }

  return results;
}

function detailValidation(
  snapshot: SectorSnapshot,
  sourceId: string,
  section: 'maintenance' | 'adjustment' | 'development',
  line: string,
): AssistedValidation | null {
  const tnl = normalizeTnl(line);
  if (!tnl) return null;

  let description = '';
  let interpretedAs = '';
  let kind: AssistedValidation['kind'];
  let question = '';

  if (section === 'maintenance') {
    const producing = /PRODUZINDO|RODANDO|EM PRODUCAO/.test(canonical(line));
    description = currentDescription(producing ? snapshot.maintenanceProducing : snapshot.maintenanceStopped, sourceId, tnl);
    interpretedAs = producing ? 'Manutenção produzindo' : 'Manutenção parada';
    kind = 'maintenance-detail';
    question = `Qual é o motivo/detalhe da manutenção da ${tnl}?`;
  } else if (section === 'adjustment') {
    description = currentDescription(snapshot.adjustments, sourceId, tnl);
    interpretedAs = 'Ajuste';
    kind = 'adjustment-detail';
    question = `Qual é o motivo do ajuste da ${tnl}?`;
  } else {
    description = currentDescription(snapshot.development, sourceId, tnl);
    interpretedAs = 'Desenvolvimento';
    kind = 'development-detail';
    question = `Qual é o detalhe do desenvolvimento da ${tnl}?`;
  }

  if (description || cleanDescription(line)) return null;

  return {
    id: validationId(sourceId, section, tnl, kind),
    kind,
    severity: section === 'development' ? 'info' : 'warning',
    title: `${tnl} · detalhe não informado`,
    message: `A ${tnl} foi classificada em ${interpretedAs.toLowerCase()}, mas a linha não traz nenhum detalhe adicional.`,
    question,
    interpretedAs,
    missingFields: ['Descrição'],
    sourceId,
    sourceLine: line,
    section,
    tnl,
  };
}

function absenceValidation(sourceId: string, line: string): AssistedValidation | null {
  const c = canonical(line);
  if (/FERIAS|ATESTADO|ATRAS|FALTA|AFASTAD|AFASTAMENTO|LICENCA/.test(c)) return null;
  const person = titleCaseName(line);
  if (!person) return null;
  return {
    id: validationId(sourceId, 'absence', person, 'absence-type'),
    kind: 'absence-type',
    severity: 'warning',
    title: `${person} · situação não informada`,
    message: 'O nome apareceu em Falta/Atraso, mas sem informar qual é a situação.',
    question: `Qual é a situação de ${person}?`,
    interpretedAs: 'Falta (provisório)',
    missingFields: ['Tipo de ausência'],
    sourceId,
    sourceLine: line,
    section: 'absence',
    person,
  };
}

export function buildAssistedValidations(snapshot: SectorSnapshot): AssistedValidation[] {
  const validations: AssistedValidation[] = [];

  snapshot.messages.forEach((message) => {
    let section: SectionKey | null = null;
    const evidence = new Map<SectionKey, { na: boolean; data: boolean; dataLine: string }>();

    message.body.split('\n').forEach((rawLine) => {
      const line = stripMarkup(rawLine);
      if (!line) return;
      const detected = detectSection(line);
      if (detected) {
        section = detected;
        if (!evidence.has(detected)) evidence.set(detected, { na: false, data: false, dataLine: '' });
        return;
      }
      if (!section || isAdministrativeLine(line)) return;

      const state = evidence.get(section) || { na: false, data: false, dataLine: '' };
      if (isNA(line)) {
        state.na = true;
        evidence.set(section, state);
        return;
      }
      state.data = true;
      if (!state.dataLine) state.dataLine = line;
      evidence.set(section, state);

      if (section === 'preparation' || section === 'nextSetups') {
        validations.push(...setupValidations(snapshot, message.id, section, line));
        return;
      }
      if (section === 'maintenance' || section === 'adjustment' || section === 'development') {
        const validation = detailValidation(snapshot, message.id, section, line);
        if (validation) validations.push(validation);
        return;
      }
      if (section === 'absence') {
        const validation = absenceValidation(message.id, line);
        if (validation) validations.push(validation);
      }
    });

    evidence.forEach((state, evidenceSection) => {
      if (!state.na || !state.data) return;
      validations.push({
        id: validationId(message.id, evidenceSection, sectionLabels[evidenceSection], 'na-with-data'),
        kind: 'na-with-data',
        severity: 'warning',
        title: `${sectionLabels[evidenceSection]} · N/A junto com informação`,
        message: 'A mesma seção contém N/A e também uma informação real. O motor manteve a informação real, mas vale confirmar que esse era o preenchimento correto.',
        question: `Confirme se os dados de ${sectionLabels[evidenceSection].toLowerCase()} devem prevalecer sobre o N/A.`,
        interpretedAs: 'Dados reais mantidos',
        missingFields: ['Confirmação'],
        sourceId: message.id,
        sourceLine: state.dataLine,
        section: evidenceSection,
      });
    });
  });

  return [...new Map(validations.map((item) => [item.id, item])).values()];
}

function updateSetupRecords(snapshot: SectorSnapshot, validation: AssistedValidation, decision: AssistedValidationDecision): SectorSnapshot {
  if (!validation.tnl) return snapshot;
  const tnl = validation.tnl;
  const sourceId = validation.sourceId;

  const update = (items: SetupRecord[]) => items.map((item) => {
    if (!sameSource(item, sourceId, tnl)) return item;
    return {
      ...item,
      severity: decision.severity ?? item.severity,
      time: decision.time !== undefined ? (decision.time.trim() || undefined) : item.time,
    };
  });

  if (validation.kind !== 'setup-state' || !decision.setupPlacement) {
    return {
      ...snapshot,
      setups: update(snapshot.setups),
      upcomingSetups: update(snapshot.upcomingSetups),
      nextShiftSetups: update(snapshot.nextShiftSetups),
    };
  }

  const all = [...snapshot.setups, ...snapshot.upcomingSetups, ...snapshot.nextShiftSetups];
  const existing = all.find((item) => sameSource(item, sourceId, tnl));
  if (!existing) return snapshot;
  const without = (items: SetupRecord[]) => items.filter((item) => !sameSource(item, sourceId, tnl));
  const severity = decision.severity ?? existing.severity;
  const time = decision.time?.trim() || undefined;

  const moved: SetupRecord = decision.setupPlacement === 'active'
    ? { ...existing, severity, status: 'active', shift: snapshot.currentShift, time: undefined }
    : decision.setupPlacement === 'scheduled-next'
      ? { ...existing, severity, status: 'scheduled', shift: snapshot.nextShift, time }
      : { ...existing, severity, status: 'scheduled', shift: snapshot.currentShift, time };

  return {
    ...snapshot,
    setups: decision.setupPlacement === 'active' ? [...without(snapshot.setups), moved] : without(snapshot.setups),
    upcomingSetups: decision.setupPlacement === 'scheduled-current' ? [...without(snapshot.upcomingSetups), moved] : without(snapshot.upcomingSetups),
    nextShiftSetups: decision.setupPlacement === 'scheduled-next' ? [...without(snapshot.nextShiftSetups), moved] : without(snapshot.nextShiftSetups),
  };
}

function updateMachineDescription(items: MachineRecord[], sourceId: string, tnl: string, description: string | undefined): MachineRecord[] {
  if (description === undefined) return items;
  const normalized = description.trim();
  return items.map((item) => sameSource(item, sourceId, tnl) ? { ...item, description: normalized || undefined } : item);
}

export function applyAssistedValidation(
  snapshot: SectorSnapshot,
  validation: AssistedValidation,
  decision: AssistedValidationDecision,
): SectorSnapshot {
  if (validation.kind === 'setup-severity' || validation.kind === 'setup-state' || validation.kind === 'setup-time') {
    return updateSetupRecords(snapshot, validation, decision);
  }

  if (validation.tnl && validation.kind === 'maintenance-detail') {
    return {
      ...snapshot,
      maintenanceStopped: updateMachineDescription(snapshot.maintenanceStopped, validation.sourceId, validation.tnl, decision.description),
      maintenanceProducing: updateMachineDescription(snapshot.maintenanceProducing, validation.sourceId, validation.tnl, decision.description),
    };
  }

  if (validation.tnl && validation.kind === 'adjustment-detail') {
    return { ...snapshot, adjustments: updateMachineDescription(snapshot.adjustments, validation.sourceId, validation.tnl, decision.description) };
  }

  if (validation.tnl && validation.kind === 'development-detail') {
    return { ...snapshot, development: updateMachineDescription(snapshot.development, validation.sourceId, validation.tnl, decision.description) };
  }

  if (validation.person && validation.kind === 'absence-type' && decision.absenceType) {
    return {
      ...snapshot,
      absences: snapshot.absences.map((item) => item.sourceId === validation.sourceId && canonical(item.name) === canonical(validation.person || '')
        ? { ...item, type: decision.absenceType as AbsenceRecord['type'] }
        : item),
    };
  }

  return snapshot;
}
