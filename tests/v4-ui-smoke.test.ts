import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import AppV4 from '../src/app/AppV4';
import ValidationHub from '../src/app/ValidationHub';
import { buildAssistedValidations } from '../src/engine/assistedValidation';
import { parseSector } from '../src/engine/parser';

const noop = vi.fn();
const hub = (props: Record<string, unknown>) => React.createElement(ValidationHub, props as never);

describe('V4 UI smoke', () => {
  it('renders the cockpit shell', () => {
    const html = renderToStaticMarkup(React.createElement(AppV4));
    expect(html).toContain('Início de turno');
    expect(html).toContain('PASSAGEM');
    expect(html).toContain('Entrada');
  });

  it('renders the clear validation state', () => {
    const snapshot = parseSector('[13/08/2026, 14:00:00] Lucas: LINHA 5 - INÍCIO DE TURNO\nPREPARAÇÃO 2° TURNO:\n🔴 TNL 093 - Em setup', 2, 3);
    const html = renderToStaticMarkup(hub({ snapshot, validations: [], issues: [], attentions: [], resolvedCount: 1, onApplyValidation: noop, onResolveValidation: noop, onApplyAttention: noop, onValidateAttention: noop, onReopenAttention: noop }));
    expect(html).toContain('Sem pendências');
  });

  it('renders TNL 069 as a compact confirmation item', () => {
    const snapshot = parseSector('[13/08/2026, 14:00:00] Lucas: LINHA 5 - INÍCIO DE TURNO\nPREPARAÇÃO 2° TURNO:\nTNL 069 - Em setup', 2, 3);
    const validations = buildAssistedValidations(snapshot);
    const html = renderToStaticMarkup(hub({ snapshot, validations, issues: [], attentions: [], resolvedCount: 0, onApplyValidation: noop, onResolveValidation: noop, onApplyAttention: noop, onValidateAttention: noop, onReopenAttention: noop }));
    expect(validations.some((item) => item.tnl === 'TNL 069')).toBe(true);
    expect(html).toContain('CONFIRMAR');
    expect(html).toContain('TNL 069');
  });
});
