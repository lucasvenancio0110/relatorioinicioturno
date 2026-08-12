import { describe, expect, it } from 'vitest';
import { parseSector } from '../src/engine/parser';

describe('Seleção manual do próximo turno', () => {
  it('aceita 2º turno atual com 1º turno como próximo', () => {
    const raw = `[12/08/2026, 15:00:00] Preparador Linha 1: *LINHA 1 - INÍCIO DE TURNO*\n\n*PROXIMOS SETUPS:*\n🔴 TNL 030 - 1°T`;
    const snapshot = parseSector(raw, 2, 1);

    expect(snapshot.currentShift).toBe(2);
    expect(snapshot.nextShift).toBe(1);
    expect(snapshot.nextShiftSetups.map((item) => item.tnl)).toContain('TNL 030');
  });

  it('não permite rota inválida com turno atual igual ao próximo no motor', () => {
    const snapshot = parseSector('', 2, 2);
    expect(snapshot.nextShift).toBe(3);
  });
});
