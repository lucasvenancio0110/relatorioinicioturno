import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AssistedValidationCard from '../src/app/AssistedValidationCard';
import OperationalAttentionCard from '../src/app/OperationalAttentionCard';
import ValidationHub from '../src/app/ValidationHub';
import { buildAssistedValidations } from '../src/engine/assistedValidation';
import { auditSnapshot } from '../src/engine/audit';
import { parseSector } from '../src/engine/parser';

const noop = vi.fn();

function developmentScenario() {
  const snapshot = parseSector('[13/08/2026, 14:00:00] Nattan Neo: LINHA 8 - INÍCIO DE TURNO\nDESENVOLVIMENTO:\nTNL 118', 2, 3);
  const validation = buildAssistedValidations(snapshot).find((item) => item.tnl === 'TNL 118');
  if (!validation) throw new Error('Validação da TNL 118 não encontrada');
  return { snapshot, validation };
}

function overlapScenario() {
  const raw = '[13/08/2026, 14:00:00] Ewerson Fabian Neo: LINHA 1 - INÍCIO DE TURNO\nMANUTENÇÃO:\nTNL 002 - Troca da chave\nPROXIMOS SETUPS:\nTNL 002 - 19:00';
  const snapshot = parseSector(raw, 2, 3);
  const attention = auditSnapshot(snapshot).attentions.find((item) => item.tnl === 'TNL 002');
  if (!attention) throw new Error('Sobreposição da TNL 002 não encontrada');
  return { snapshot, attention };
}

describe('V9 validation flow', () => {
  it('resume a fila em uma decisão curta e acionável', () => {
    const { snapshot, validation } = developmentScenario();
    const html = renderToStaticMarkup(React.createElement(ValidationHub, {
      snapshot,
      validations: [validation],
      issues: [],
      attentions: [],
      resolvedCount: 0,
      onApplyValidation: noop,
      onResolveValidation: noop,
      onApplyAttention: noop,
      onValidateAttention: noop,
      onReopenAttention: noop,
    }));
    expect(html).toContain('TNL 118');
    expect(html).toContain('Desenvolvimento · falta detalhe');
    expect(html).toContain('Confirmar');
    expect(html).not.toContain('O que precisa de você');
  });

  it('reduz detalhe ausente a uma pergunta e um campo', () => {
    const { snapshot, validation } = developmentScenario();
    const html = renderToStaticMarkup(React.createElement(AssistedValidationCard, {
      snapshot,
      validation,
      onApply: noop,
      onResolve: noop,
    }));
    expect(html).toContain('Qual é o detalhe?');
    expect(html).toContain('Ex.: Programação');
    expect(html).toContain('>Salvar<');
    expect(html).not.toContain(validation.message);
  });

  it('transforma sobreposição em escolha única com sugestão e confirmação final', () => {
    const { snapshot, attention } = overlapScenario();
    const html = renderToStaticMarkup(React.createElement(OperationalAttentionCard, {
      snapshot,
      attention,
      resolved: false,
      onApply: noop,
      onValidate: noop,
      onReopen: noop,
    }));
    expect(html).toContain('O que está correto?');
    expect(html).toContain('Manter nos dois');
    expect(html).toContain('Só manutenção');
    expect(html).toContain('Confirmar decisão');
    expect(html).not.toContain('>Decidir<');
  });

  it('oferece continuidade quando existe outra pendência', () => {
    const { snapshot, validation } = developmentScenario();
    const detailHtml = renderToStaticMarkup(React.createElement(AssistedValidationCard, {
      snapshot,
      validation,
      hasNext: true,
      onApply: noop,
      onResolve: noop,
    }));
    expect(detailHtml).toContain('Salvar e próxima');

    const overlap = overlapScenario();
    const overlapHtml = renderToStaticMarkup(React.createElement(OperationalAttentionCard, {
      snapshot: overlap.snapshot,
      attention: overlap.attention,
      resolved: false,
      hasNext: true,
      onApply: noop,
      onValidate: noop,
      onReopen: noop,
    }));
    expect(overlapHtml).toContain('Confirmar e próxima');
  });
});
