import { describe, expect, it } from 'vitest';
import { createReportBlock, createReportLine, parseReportDocument, serializeReportDocument } from '../src/engine/reportDocument';

describe('Documento de relatório editável por blocos', () => {
  it('faz round-trip sem alterar a formatação de WhatsApp', () => {
    const input = `*2° TURNO*\n*SITUAÇÃO DO SETOR ⬇️⬇️⬇️*\n\n*SETUP:*\n🔴 TNL 006 - Iniciar\n🔵 TNL 029 - Em Setup\n\n*OBSERVAÇÕES:*\nN/A`;
    expect(serializeReportDocument(parseReportDocument(input))).toBe(input);
  });

  it('permite editar uma linha e copiar exatamente o estado dos blocos', () => {
    const blocks = parseReportDocument('*SETUP:*\n🔴 TNL 006 - Iniciar');
    blocks[0].lines[1].text = '🔴 TNL 006 - Em Setup confirmado';
    expect(serializeReportDocument(blocks)).toBe('*SETUP:*\n🔴 TNL 006 - Em Setup confirmado');
  });

  it('permite adicionar linhas e blocos mantendo títulos em negrito', () => {
    const blocks = parseReportDocument('*SETUP:*\nN/A');
    blocks[0].lines = [blocks[0].lines[0], createReportLine('🔵 TNL 087 - Após manutenção')];
    blocks.push(createReportBlock('OBSERVAÇÃO EXTRA:', 'Confirmado com a linha'));

    expect(serializeReportDocument(blocks)).toContain('*SETUP:*\n🔵 TNL 087 - Após manutenção');
    expect(serializeReportDocument(blocks)).toContain('*OBSERVAÇÃO EXTRA:*\nConfirmado com a linha');
  });
});
