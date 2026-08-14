import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AppV5 from '../src/app/AppV5';
import ReportEditor from '../src/app/ReportEditor';
import ValidationHub from '../src/app/ValidationHub';
import { buildAssistedValidations } from '../src/engine/assistedValidation';
import { parseSector } from '../src/engine/parser';

const noop = vi.fn();

describe('V8 clean UX', () => {
  it('não mostra decremento inútil quando os dados manuais estão em N/A', () => {
    const html = renderToStaticMarkup(React.createElement(AppV5));
    expect(html).toContain('Dados manuais do setor');
    expect(html).toContain('Aumentar Check Point');
    expect(html).not.toContain('Diminuir Check Point');
    expect(html).not.toContain('Preencha antes de colar as mensagens');
  });

  it('mantém a validação como uma linha clicável sem CTA textual duplicado', () => {
    const snapshot = parseSector('[13/08/2026, 14:00:00] Lucas: LINHA 5 - INÍCIO DE TURNO\nPREPARAÇÃO 2° TURNO:\nTNL 069 - Em setup', 2, 3);
    const validations = buildAssistedValidations(snapshot);
    const html = renderToStaticMarkup(React.createElement(ValidationHub, {
      snapshot,
      validations,
      issues: [],
      attentions: [],
      resolvedCount: 0,
      onApplyValidation: noop,
      onResolveValidation: noop,
      onApplyAttention: noop,
      onValidateAttention: noop,
      onReopenAttention: noop,
    }));
    expect(html).toContain('Validação');
    expect(html).toContain('TNL 069');
    expect(html).not.toContain('O que precisa de você');
    expect(html).not.toContain('>Resolver<');
  });

  it('abre o relatório em modo documento, sem lápis em todos os blocos', () => {
    const html = renderToStaticMarkup(React.createElement(ReportEditor, {
      fullReport: '*SETUP:*\n🔴 TNL 093 - Em Setup\n\n*AJUSTES:*\nN/A',
      compactReport: '*SETUP:*\n🔴 TNL 093 - Em Setup',
      persistenceRevision: 8001,
    }));
    expect(html).toContain('Editar');
    expect(html).not.toContain('Editar bloco 1');
    expect(html).not.toContain('Adicionar bloco');
    expect(html).not.toContain('Automático');
  });

  it('mantém as duas versões e as ações de cópia disponíveis', () => {
    const html = renderToStaticMarkup(React.createElement(ReportEditor, {
      fullReport: '*SETUP:*\nN/A',
      compactReport: '*SETUP:*\nN/A',
      persistenceRevision: 8002,
    }));
    expect(html).toContain('Completo');
    expect(html).toContain('Resumido');
    expect(html).toContain('Copiar completo');
    expect(html).toContain('Copiar os dois');
  });
});
