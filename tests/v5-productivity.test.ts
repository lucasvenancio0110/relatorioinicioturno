import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AppV5 from '../src/app/AppV5';
import { replaceReportBlockBody, reportBlockBody, reportBlockHeadingCount } from '../src/app/ReportEditor';
import type { ManualCounters } from '../src/domain/types';
import { buildAssistedValidations } from '../src/engine/assistedValidation';
import { splitMessages } from '../src/engine/messages';
import { parseSector } from '../src/engine/parser';
import { parseReportDocument, serializeReportDocument } from '../src/engine/reportDocument';
import { generateFullReport } from '../src/engine/reports';

const counters: ManualCounters = {
  checkpoint: 1,
  cqMachining: 9,
  cqClosing: 2,
  cqReinspection: 3,
  selectionShift1: 0,
  selectionShift2: 1,
  selectionShift3: 0,
  selectionAll: 0,
  selectionTnc: 0,
};

describe('V5 produtividade desktop', () => {
  it('mostra dados manuais antes da entrada de mensagens', () => {
    const html = renderToStaticMarkup(React.createElement(AppV5));
    const manualIndex = html.indexOf('Dados manuais do setor');
    const inputIndex = html.indexOf('Mensagens dos preparadores');
    expect(manualIndex).toBeGreaterThanOrEqual(0);
    expect(inputIndex).toBeGreaterThan(manualIndex);
    expect(html).not.toContain('CQ Usinagem');
  });

  it('reconhece LINHA TNL 12.2 como uma linha válida', () => {
    const raw = '[13/08/2026, 14:00:00] Juliano Neo: LINHA TNL 12.2 - INÍCIO DE TURNO\nAJUSTE:\nTNL 135 - Barra travando';
    const messages = splitMessages(raw);
    expect(messages).toHaveLength(1);
    expect(messages[0].line).toBe('TNL 12.2');
  });

  it('classifica afastado sem gerar confirmação de tipo de ausência', () => {
    const raw = '[13/08/2026, 14:00:00] Preparador: LINHA 1 - INÍCIO DE TURNO\nFALTA/ATRASO:\nJoão - Afastado';
    const snapshot = parseSector(raw, 2, 3);
    expect(snapshot.absences).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'João', type: 'leave' })]));
    expect(buildAssistedValidations(snapshot).some((item) => item.kind === 'absence-type')).toBe(false);
  });

  it('inclui AFASTADOS e remove CQ USINAGEM do relatório completo', () => {
    const raw = '[13/08/2026, 14:00:00] Preparador: LINHA 1 - INÍCIO DE TURNO\nFALTA/ATRASO:\nMaria - Afastada';
    const report = generateFullReport(parseSector(raw, 2, 3), counters);
    expect(report).toContain('*AFASTADOS:*\nMaria');
    expect(report).not.toContain('CQ USINAGEM');
    expect(report).toContain('*CQ FECHAMENTO:*\n2');
  });

  it('edita o conteúdo inteiro preservando o título do bloco', () => {
    const block = parseReportDocument('*DESENVOLVIMENTO:*\nTNL 118 - Rodando\nTNL 134 - Programação')[0];
    expect(reportBlockHeadingCount(block)).toBe(1);
    expect(reportBlockBody(block)).toBe('TNL 118 - Rodando\nTNL 134 - Programação');

    const edited = replaceReportBlockBody(block, 'TNL 118 - Operador rodando\nTNL 142 - Quasar Eng');
    expect(serializeReportDocument([edited])).toBe('*DESENVOLVIMENTO:*\nTNL 118 - Operador rodando\nTNL 142 - Quasar Eng');
  });

  it('preserva cabeçalhos múltiplos do bloco inicial ao editar o corpo', () => {
    const block = parseReportDocument('*2° TURNO*\n*SITUAÇÃO DO SETOR ⬇️⬇️⬇️*')[0];
    expect(reportBlockHeadingCount(block)).toBe(2);
    const edited = replaceReportBlockBody(block, 'Revisado');
    expect(serializeReportDocument([edited])).toBe('*2° TURNO*\n*SITUAÇÃO DO SETOR ⬇️⬇️⬇️*\nRevisado');
  });
});
