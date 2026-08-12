import { describe, expect, it } from 'vitest';
import { auditSnapshot } from '../src/engine/audit';
import { parseSector } from '../src/engine/parser';

const coexistenceInput = `[11/08/2026, 15:00:00] Preparador Teste: *BOA TARDE*
*LINHA 5 - INÍCIO DE TURNO*

*PREPARAÇÃO 2° TURNO:*
🔵 TNL 087 - Após manutenção

*MANUTENÇÃO:*
TNL 087 - Preventiva programada

*AJUSTE:*
N/A`;

describe('Motor V2 - integridade operacional', () => {
  it('aceita manutenção + setup após manutenção como coexistência válida', () => {
    const snapshot = parseSector(coexistenceInput, 2);
    const audit = auditSnapshot(snapshot);

    expect(snapshot.maintenanceStopped.map((item) => item.tnl)).toContain('TNL 087');
    expect(snapshot.setups.map((item) => item.tnl)).toContain('TNL 087');
    expect(audit.contradictions).toBe(0);
    expect(audit.missingMachines).toEqual([]);
    expect(audit.confidence).toBe(100);
  });

  it('detecta contradição quando a mesma TNL está parada e produzindo na manutenção', () => {
    const input = `[11/08/2026, 15:01:00] Preparador Teste: *LINHA 4 - INÍCIO DE TURNO*
*MANUTENÇÃO:*
TNL 060 - Parada por falha no alimentador
TNL 060 - Rodando após intervenção`;

    const audit = auditSnapshot(parseSector(input, 2));

    expect(audit.contradictions).toBe(1);
    expect(audit.issues.some((issue) => issue.kind === 'contradiction' && issue.tnl === 'TNL 060')).toBe(true);
    expect(audit.confidence).toBeLessThan(100);
  });

  it('detecta uma TNL que existia no bruto e desapareceu do modelo consolidado', () => {
    const snapshot = parseSector(coexistenceInput, 2);
    snapshot.maintenanceStopped = [];
    snapshot.setups = [];

    const audit = auditSnapshot(snapshot);

    expect(audit.sourceMachines).toBe(1);
    expect(audit.missingMachines).toEqual(['TNL 087']);
    expect(audit.issues.some((issue) => issue.kind === 'missing-machine')).toBe(true);
  });

  it('expande várias TNLs escritas na mesma linha sem misturar a descrição', () => {
    const input = `[11/08/2026, 15:02:00] Preparador Teste: *LINHA 2 - INÍCIO DE TURNO*
*AJUSTE:*
TNL 13, 143 - Quebra das ferramentas`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.adjustments).toHaveLength(2);
    expect(snapshot.adjustments.map((item) => item.tnl)).toEqual(['TNL 013', 'TNL 143']);
    expect(snapshot.adjustments.every((item) => item.description === 'Quebra das ferramentas')).toBe(true);
    expect(auditSnapshot(snapshot).missingMachines).toEqual([]);
  });
});
