import { describe, expect, it } from 'vitest';
import { parseSector } from '../src/engine/parser';
import { generateCompactReport, generateFullReport } from '../src/engine/reports';

const counters = {
  checkpoint: 0,
  cqMachining: 0,
  cqClosing: 0,
  cqReinspection: 0,
  selectionShift1: 0,
  selectionShift2: 0,
  selectionShift3: 0,
  selectionAll: 0,
  selectionTnc: 0,
};

describe('Compatibilidade operacional herdada da V1', () => {
  it('interpreta formatos legados de horário como próximos setups', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔴 TNL 010 - 19 H
🔵 TNL 011 - 18h30m`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.upcomingSetups.map((item) => [item.tnl, item.time])).toEqual([
      ['TNL 010', '19:00'],
      ['TNL 011', '18:30'],
    ]);
  });

  it('entende turno por extenso e TNL escrita como TNL N°', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*PROXIMOS SETUPS:*
🔴 TNL N° 7 - TERCEIRO`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.nextShiftSetups).toHaveLength(1);
    expect(snapshot.nextShiftSetups[0].tnl).toBe('TNL 007');
    expect(snapshot.nextShiftSetups[0].shift).toBe(3);
  });

  it('mantém estados legados de preparação como setup atual mesmo com turno explícito', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
TNL 020 - aguardando setup 2°T
TNL 021 - setup em andamento 2°T
TNL 022 - máquina em setup 2°T`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.setups.map((item) => item.tnl)).toEqual(['TNL 020', 'TNL 021', 'TNL 022']);
    expect(snapshot.upcomingSetups).toHaveLength(0);
  });

  it('preserva desenvolvimento livre e prefere a versão descrita da mesma TNL', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*DESENVOLVIMENTO:*
MILLTAP
Estudo ferramenta especial
TNL 118
TNL 118 - Programação`;

    const snapshot = parseSector(input, 2);
    const report = generateFullReport(snapshot, counters);

    expect(snapshot.developmentNotes).toEqual(['Estudo ferramenta especial', 'MILLTAP']);
    expect(snapshot.development).toHaveLength(1);
    expect(snapshot.development[0]).toMatchObject({ tnl: 'TNL 118', description: 'Programação' });
    expect(report).toContain('MILLTAP');
    expect(report).toContain('Estudo ferramenta especial');
  });

  it('preserva manutenção livre sem inventar TNL e respeita estado produzindo', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*MANUTENÇÃO:*
Index geral
Linha de óleo rodando`;

    const snapshot = parseSector(input, 2);
    const compact = generateCompactReport(snapshot);

    expect(snapshot.maintenanceStoppedNotes).toEqual(['Index geral']);
    expect(snapshot.maintenanceProducingNotes).toEqual(['Linha de óleo rodando']);
    expect(compact).toContain('Index geral');
    expect(compact).toContain('Linha de óleo rodando');
  });

  it('limpa ruído de ausência e observação editada', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*FALTA/ATRASO:*
Pessoa Um / Faltas
Pessoa Dois (atrasado)

*OBSERVAÇÕES:*
Atenção com refrigeração <mensagem editada>
<mensagem editada>`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.absences.map((item) => [item.name, item.type])).toEqual([
      ['Pessoa Dois', 'delay'],
      ['Pessoa Um', 'absence'],
    ]);
    expect(snapshot.observations).toEqual(['Atenção com refrigeração']);
  });
});
