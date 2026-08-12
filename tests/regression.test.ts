import { describe, expect, it } from 'vitest';
import { parseSector } from '../src/engine/parser';

describe('Regressões descobertas pelo benchmark operacional', () => {
  it('preserva Em Setup como descrição operacional completa', () => {
    const input = `[11/08/2026, 15:00:00] Preparador Teste: *LINHA 1 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔵 TNL 29 - EM SETUP
🔴 TNL 73 -EM SETUP`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.setups.map((item) => item.description)).toEqual(['Em Setup', 'Em Setup']);
  });

  it('reconhece corretamente linha de família TNL 12.2/20', () => {
    const input = `[11/08/2026, 15:01:00] Preparador Teste: *LINHA TNL 12.2/ 20- INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔴 TNL 126 - Em Setup`;

    const snapshot = parseSector(input, 2);

    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.messages[0].line).toBe('TNL 12.2/20');
    expect(snapshot.setups[0].description).toBe('Em Setup');
  });
});
