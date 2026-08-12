import { describe, expect, it } from 'vitest';
import { parseSector } from '../src/engine/parser';
import { generateCompactReport } from '../src/engine/reports';
import { demoInput } from '../src/features/demo';

describe('Motor V2', () => {
  it('consolida mensagens e classifica setup por estado, horário e turno', () => {
    const result = parseSector(demoInput, 2);
    expect(result.messages).toHaveLength(2);
    expect(result.setups.map((item) => item.tnl)).toEqual(['TNL 029', 'TNL 073']);
    expect(result.upcomingSetups.map((item) => item.tnl)).toEqual(['TNL 099']);
    expect(result.upcomingSetups[0].time).toBe('19:00');
    expect(result.nextShiftSetups.map((item) => item.tnl)).toEqual(['TNL 005', 'TNL 066']);
  });

  it('mantém domínios operacionais independentes', () => {
    const result = parseSector(demoInput, 2);
    expect(result.maintenanceStopped.map((item) => item.tnl)).toEqual(['TNL 056', 'TNL 060']);
    expect(result.adjustments.map((item) => item.tnl)).toEqual(['TNL 053']);
    expect(result.selections.map((item) => item.tnl)).toEqual(['TNL 079', 'TNL 081']);
    expect(result.operators4).toEqual(['Pessoa B']);
  });

  it('gera a versão resumida na ordem operacional esperada', () => {
    const report = generateCompactReport(parseSector(demoInput, 2));
    expect(report).toContain('*MÁQUINAS EM MANUTENÇÃO PARADA*');
    expect(report).toContain('*SETUP*');
    expect(report).toContain('*PRÓXIMOS SETUPS*');
    expect(report).toContain('*SETUPS 3°T*');
    expect(report).toContain('*MAQUINAS EM AJUSTES*');
    expect(report).toContain('*ORDENS PARA SELEÇÃO*');
    expect(report).toContain('*BOM TRABALHO*');
  });
});
