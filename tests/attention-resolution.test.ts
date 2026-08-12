import { describe, expect, it } from 'vitest';
import { applyAttentionDecision } from '../src/engine/attentionResolution';
import { auditSnapshot } from '../src/engine/audit';
import { parseSector } from '../src/engine/parser';

const input = `[11/08/2026, 15:26:26] Lucas Venancio: *BOA TARDE*
*LINHA 5 - INÍCIO DE TURNO*

*PREPARAÇÃO 2° TURNO:*
🔵 TNL 087 - Após manutenção

*MANUTENÇÃO:*
TNL 087 - Preventiva Bi-anual`;

describe('decisões nas atenções operacionais', () => {
  it('mantém somente manutenção quando o técnico escolhe esse contexto', () => {
    const snapshot = parseSector(input, 2, 3);
    const attention = auditSnapshot(snapshot).attentions[0];
    const result = applyAttentionDecision(snapshot, attention, {
      selectedContextKeys: ['maintenance-stopped'],
    });

    expect(result.maintenanceStopped.map((item) => item.tnl)).toContain('TNL 087');
    expect(result.upcomingSetups.map((item) => item.tnl)).not.toContain('TNL 087');
    expect(auditSnapshot(result).attentions).toHaveLength(0);
    expect(auditSnapshot(result).missingMachines).toEqual([]);
  });

  it('mantém somente o próximo setup quando o técnico escolhe esse contexto', () => {
    const snapshot = parseSector(input, 2, 3);
    const attention = auditSnapshot(snapshot).attentions[0];
    const result = applyAttentionDecision(snapshot, attention, {
      selectedContextKeys: ['setup-upcoming'],
    });

    expect(result.maintenanceStopped.map((item) => item.tnl)).not.toContain('TNL 087');
    expect(result.upcomingSetups.map((item) => item.tnl)).toContain('TNL 087');
    expect(auditSnapshot(result).attentions).toHaveLength(0);
  });

  it('edita os textos dos dois contextos sem quebrar a sobreposição', () => {
    const snapshot = parseSector(input, 2, 3);
    const attention = auditSnapshot(snapshot).attentions[0];
    const result = applyAttentionDecision(snapshot, attention, {
      selectedContextKeys: ['maintenance-stopped', 'setup-upcoming'],
      descriptions: {
        'maintenance-stopped': 'Preventiva concluindo',
        'setup-upcoming': 'Liberar e iniciar após manutenção',
      },
    });

    expect(result.maintenanceStopped.find((item) => item.tnl === 'TNL 087')?.description).toBe('Preventiva concluindo');
    expect(result.upcomingSetups.find((item) => item.tnl === 'TNL 087')?.description).toBe('Liberar e iniciar após manutenção');
    expect(auditSnapshot(result).attentions).toHaveLength(1);
  });
});
