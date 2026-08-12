import { describe, expect, it } from 'vitest';
import { getSharedReportBlockKey, parseReportDocument, serializeReportDocument, syncSharedReportBlock } from '../src/engine/reportDocument';

describe('Edição compartilhada entre Completo e Resumido', () => {
  it('sincroniza SETUP sem alterar blocos exclusivos', () => {
    const full = parseReportDocument('*SETUP:*\n🔴 TNL 006 - Iniciar\n\n*ATESTADO:*\nRodolfo');
    const compact = parseReportDocument('*SETUP*\n🔴 TNL 006 - Iniciar\n\n*BOM TRABALHO*');
    const setup = full[0];
    const edited = {
      ...setup,
      lines: setup.lines.map((line, index) => index === 1 ? { ...line, text: '🔴 TNL 006 - Em Setup confirmado' } : line),
    };

    const syncedCompact = syncSharedReportBlock(compact, getSharedReportBlockKey(setup), edited);
    const compactText = serializeReportDocument(syncedCompact);

    expect(compactText).toContain('🔴 TNL 006 - Em Setup confirmado');
    expect(compactText).toContain('*BOM TRABALHO*');
    expect(serializeReportDocument(full)).toContain('*ATESTADO:*\nRodolfo');
  });

  it('não vincula ORDENS PARA SELEÇÃO porque os dois relatórios têm conteúdos diferentes', () => {
    const full = parseReportDocument('*ORDENS PARA SELEÇÃO:*\nSeleção 1° turno: 02');
    expect(getSharedReportBlockKey(full[0])).toBeNull();
  });
});
