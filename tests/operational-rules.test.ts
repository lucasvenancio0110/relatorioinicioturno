import { describe, expect, it } from 'vitest';
import { auditSnapshot } from '../src/engine/audit';
import { parseSector } from '../src/engine/parser';
import { generateCompactReport } from '../src/engine/reports';

const deferredSetupInput = `[11/08/2026, 15:26:26] Preparador Linha 5: *BOA TARDE*
*LINHA 5 - INÍCIO DE TURNO*

*PREPARAÇÃO 2° TURNO:*
🔵 TNL 087 - Após manutenção

*MANUTENÇÃO:*
TNL 087 - Preventiva Bi-anual

*OBSERVAÇÕES:*
N/A`;

const indentedWhatsAppInput = `[11/08/2026, 15:00:00] Preparador A: *BOA TARDE*
*LINHA 1 - INÍCIO DE TURNO*
*PREPARAÇÃO 2° TURNO:*
🔵 TNL 029 - Em Setup

 [11/08/2026, 15:01:00] Preparador B: *BOA TARDE*
*LINHA 2 - INÍCIO DE TURNO*
*AJUSTE:*
TNL 013 - Quebra de ferramenta`;

describe('regras operacionais reais', () => {
  it('trata setup após manutenção como próximo setup, preservando a manutenção', () => {
    const result = parseSector(deferredSetupInput, 2);

    expect(result.setups.map((item) => item.tnl)).not.toContain('TNL 087');
    expect(result.upcomingSetups.map((item) => item.tnl)).toContain('TNL 087');
    expect(result.maintenanceStopped.map((item) => item.tnl)).toContain('TNL 087');

    const setup = result.upcomingSetups.find((item) => item.tnl === 'TNL 087');
    expect(setup?.description).toBe('Após manutenção');
    expect(setup?.status).toBe('scheduled');

    const report = generateCompactReport(result);
    expect(report).toContain('*PRÓXIMOS SETUPS*');
    expect(report).toContain('🔵 TNL 087 - Setup 2°T (Após manutenção)');
  });

  it('separa mensagens do WhatsApp mesmo quando o próximo cabeçalho vem indentado', () => {
    const result = parseSector(indentedWhatsAppInput, 2);
    const audit = auditSnapshot(result);

    expect(result.messages).toHaveLength(2);
    expect(result.messages.map((message) => message.line)).toEqual(['1', '2']);
    expect(audit.messages).toBe(2);
    expect(audit.lines).toBe(2);
  });
});
