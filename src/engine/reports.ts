import type { AbsenceRecord, MachineRecord, ManualCounters, SectorSnapshot, SetupRecord } from '../domain/types';

export const REPORT_SEPARATOR = '━━━━━━━━━━━━━━━━━━━━━━━';

const n = (value: number, pad = false) => (value === 0 ? 'N/A' : pad ? String(value).padStart(2, '0') : String(value));
const list = (items: string[]) => (items.length ? items.join('\n') : 'N/A');
const emoji = (severity: SetupRecord['severity']) => severity === 'red' ? '🔴 ' : severity === 'blue' ? '🔵 ' : severity === 'green' ? '🟢 ' : '';
const machineLine = (item: MachineRecord) => `${item.tnl}${item.description ? ` - ${item.description}` : ''}`;
const operationalList = (machines: MachineRecord[], notes: string[] = []) => list([...machines.map(machineLine), ...notes]);
const setupLine = (item: SetupRecord) => {
  if (item.status === 'active') return `${emoji(item.severity)}${item.tnl}${item.description ? ` - ${item.description}` : ' - Em Setup'}`;
  return `${emoji(item.severity)}${item.tnl} - Setup ${item.shift}°T${item.time ? ` (${item.time})` : item.description ? ` (${item.description})` : ''}`;
};
const absences = (items: AbsenceRecord[], type: AbsenceRecord['type']) => list(items.filter((item) => item.type === type).map((item) => item.name));

export function generateFullReport(snapshot: SectorSnapshot, counters: ManualCounters): string {
  return `*${snapshot.currentShift}° TURNO*\n*SITUAÇÃO DO SETOR ⬇️⬇️⬇️*\n\n*BANCADA – CHECK POINT:*\n${n(counters.checkpoint)}\n\n*ORDENS PARA SELEÇÃO:*\nSeleção 1° turno: ${n(counters.selectionShift1, true)}\nSeleção 2° turno: ${n(counters.selectionShift2, true)}\nSeleção 3° turno: ${n(counters.selectionShift3, true)}\nOs 3 turnos: ${n(counters.selectionAll, true)}\nSeleção TNC: ${n(counters.selectionTnc, true)}\n\n*CQ USINAGEM:*\n${n(counters.cqMachining)}\n\n*CQ FECHAMENTO:*\n${n(counters.cqClosing)}\n\n*CQ REINSPEÇÃO:*\n${n(counters.cqReinspection)}\n\n*MÁQUINAS EM MANUTENÇÃO PARADA:*\n${operationalList(snapshot.maintenanceStopped, snapshot.maintenanceStoppedNotes)}\n\n*MÁQUINAS EM MANUTENÇÃO PRODUZINDO:*\n${operationalList(snapshot.maintenanceProducing, snapshot.maintenanceProducingNotes)}\n\n*SETUP:*\n${list(snapshot.setups.map(setupLine))}\n\n*PRÓXIMOS SETUPS:*\n${list(snapshot.upcomingSetups.map(setupLine))}\n\n*SETUPS ${snapshot.nextShift}°T:*\n${list(snapshot.nextShiftSetups.map(setupLine))}\n\n*MAQUINAS EM AJUSTES:*\n${list(snapshot.adjustments.map(machineLine))}\n\n*AUSÊNCIAS:*\n\n*ATRASO:*\n${absences(snapshot.absences, 'delay')}\n\n*FÉRIAS:*\n${absences(snapshot.absences, 'vacation')}\n\n*FALTAS:*\n${absences(snapshot.absences, 'absence')}\n\n*ATESTADO:*\n${absences(snapshot.absences, 'certificate')}\n\n*OPERADORES COM 4 MÁQUINAS: ${String(snapshot.operators4.length).padStart(2, '0')}*\n${list(snapshot.operators4)}\n\n*DESENVOLVIMENTO:*\n${operationalList(snapshot.development, snapshot.developmentNotes)}\n\n*OBSERVAÇÕES:*\n${list(snapshot.observations)}\n\n*RESTANTE OK !*`;
}

export function generateCompactReport(snapshot: SectorSnapshot): string {
  return `*${snapshot.currentShift}° TURNO*\n*SITUAÇÃO DO SETOR ⬇️⬇️⬇️*\n\n*MÁQUINAS EM MANUTENÇÃO PARADA*\n${operationalList(snapshot.maintenanceStopped, snapshot.maintenanceStoppedNotes)}\n\n*MÁQUINAS EM MANUTENÇÃO PRODUZINDO*\n${operationalList(snapshot.maintenanceProducing, snapshot.maintenanceProducingNotes)}\n\n*SETUP*\n${list(snapshot.setups.map(setupLine))}\n\n*PRÓXIMOS SETUPS*\n${list(snapshot.upcomingSetups.map(setupLine))}\n\n*SETUPS ${snapshot.nextShift}°T*\n${list(snapshot.nextShiftSetups.map(setupLine))}\n\n*MAQUINAS EM AJUSTES*\n${list(snapshot.adjustments.map(machineLine))}\n\n*ORDENS PARA SELEÇÃO*\n${list(snapshot.selections.map((item) => item.tnl))}\n\n*BOM TRABALHO*`;
}

export function generateCombinedReport(snapshot: SectorSnapshot, counters: ManualCounters): string {
  return `${generateFullReport(snapshot, counters)}\n\n${REPORT_SEPARATOR}\n\n${generateCompactReport(snapshot)}`;
}
