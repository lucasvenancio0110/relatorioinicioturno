import { describe, expect, it } from 'vitest';
import { auditSnapshot } from '../src/engine/audit';
import { parseSector } from '../src/engine/parser';

describe('Atenções operacionais do técnico', () => {
  it('mostra manutenção + próximo setup como sobreposição válida sem reduzir a confiança', () => {
    const input = `[11/08/2026, 15:26:26] Preparador Teste: *LINHA 5 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔵 TNL 087 - Após manutenção
*MANUTENÇÃO:*
TNL 087 - Preventiva Bi-anual`;

    const audit = auditSnapshot(parseSector(input, 2, 3));
    const attention = audit.attentions.find((item) => item.tnl === 'TNL 087');

    expect(audit.review).toBe(0);
    expect(audit.confidence).toBe(100);
    expect(audit.attentionCount).toBe(1);
    expect(attention?.kind).toBe('valid-overlap');
    expect(attention?.severity).toBe('info');
    expect(attention?.contexts.map((context) => context.key)).toEqual(expect.arrayContaining(['maintenance-stopped', 'setup-upcoming']));
  });

  it('não duplica uma contradição real como simples sobreposição', () => {
    const input = `[11/08/2026, 15:10:00] Preparador Teste: *LINHA 4 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔴 TNL 060 - Em Setup
*MANUTENÇÃO:*
TNL 060 - Parada por falha`;

    const audit = auditSnapshot(parseSector(input, 2, 3));

    expect(audit.issues.some((issue) => issue.tnl === 'TNL 060' && issue.kind === 'contradiction')).toBe(true);
    expect(audit.attentions.some((attention) => attention.tnl === 'TNL 060')).toBe(false);
    expect(audit.attentionCount).toBe(audit.issues.length);
  });

  it('destaca qualquer máquina presente em dois contextos mesmo sem regra específica', () => {
    const input = `[11/08/2026, 15:20:00] Preparador Teste: *LINHA 8 - INÍCIO DE TURNO*
*AJUSTE:*
TNL 122 - Rebarba
*DESENVOLVIMENTO:*
TNL 122 - Teste de processo`;

    const audit = auditSnapshot(parseSector(input, 2, 3));
    const attention = audit.attentions.find((item) => item.tnl === 'TNL 122');

    expect(attention?.kind).toBe('multi-context');
    expect(attention?.severity).toBe('warning');
    expect(attention?.contexts).toHaveLength(2);
  });
});
