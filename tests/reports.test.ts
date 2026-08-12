import { describe, expect, it } from 'vitest';
import type { ManualCounters } from '../src/domain/types';
import { parseSector } from '../src/engine/parser';
import { generateCombinedReport, generateFullReport, REPORT_SEPARATOR } from '../src/engine/reports';

const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔵 TNL 029 - EM SETUP

*PROXIMOS SETUPS:*
🔴 TNL 030 - 3°T

*AJUSTE:*
TNL 053 - Pós-manutenção

*SELEÇÃO DE ORDENS:*
TNL 081

*MANUTENÇÃO:*
TNL 060 - Falha no alimentador

*DESENVOLVIMENTO:*
TNL 118 - Programação

*FALTA/ATRASO:*
Pessoa Teste - Férias

*OPERADOR COM 4 MÁQUINA*
Operador Teste`;

const counters: ManualCounters = {
  checkpoint: 1,
  cqMachining: 0,
  cqClosing: 2,
  cqReinspection: 5,
  selectionShift1: 2,
  selectionShift2: 7,
  selectionShift3: 5,
  selectionAll: 0,
  selectionTnc: 5,
};

describe('Saídas operacionais para WhatsApp', () => {
  it('mantém a formatação dos contadores do relatório completo', () => {
    const report = generateFullReport(parseSector(input, 2), counters);

    expect(report).toContain('*2° TURNO*');
    expect(report).toContain('Seleção 1° turno: 02');
    expect(report).toContain('Seleção 2° turno: 07');
    expect(report).toContain('Os 3 turnos: N/A');
    expect(report).toContain('🔵 TNL 029 - Em Setup');
    expect(report).toContain('🔴 TNL 030 - Setup 3°T');
    expect(report).toContain('*RESTANTE OK !*');
  });

  it('gera completo + divisor + resumido no mesmo texto para cópia única', () => {
    const report = generateCombinedReport(parseSector(input, 2), counters);

    expect(report.split(REPORT_SEPARATOR)).toHaveLength(2);
    expect(report.match(/\*2° TURNO\*/g)).toHaveLength(2);
    expect(report).toContain('*ORDENS PARA SELEÇÃO*\nTNL 081');
    expect(report.endsWith('*BOM TRABALHO*')).toBe(true);
  });
});
