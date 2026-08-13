import { describe, expect, it } from 'vitest';
import { applyAssistedValidation, buildAssistedValidations } from '../src/engine/assistedValidation';
import { parseSector } from '../src/engine/parser';

const message = (body: string, sender = 'Preparador Teste', line = '5') => `[13/08/2026, 13:00:00] ${sender}: *LINHA ${line} - INÍCIO DE TURNO*\n${body}`;

const validate = (body: string, current = 2 as 1 | 2 | 3, next = 3 as 1 | 2 | 3) => {
  const snapshot = parseSector(message(body), current, next);
  return { snapshot, validations: buildAssistedValidations(snapshot) };
};

describe('Motor V3 - validação assistida', () => {
  it('não pergunta nada quando setup atual tem estado e cor explícitos', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\n🔴 TNL 069 - Em setup`);
    expect(snapshot.setups[0]).toMatchObject({ tnl: 'TNL 069', severity: 'red', status: 'active' });
    expect(validations).toEqual([]);
  });

  it('entende Em setup sem perguntar o estado e solicita somente a cor', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 069 - Em setup`);
    expect(snapshot.setups.map((item) => item.tnl)).toEqual(['TNL 069']);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ kind: 'setup-severity', tnl: 'TNL 069', interpretedAs: 'Setup atual' });
    expect(validations[0].missingFields).toEqual(['Tipo/cor do setup']);
  });

  it('não cria pendência para setup futuro com cor e horário explícitos', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\n🔵 TNL 058 - 19:00`);
    expect(snapshot.upcomingSetups[0]).toMatchObject({ tnl: 'TNL 058', time: '19:00', severity: 'blue' });
    expect(validations).toEqual([]);
  });

  it('setup futuro com horário mas sem cor pede somente a cor', () => {
    const { validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 058 - 19:00`);
    expect(validations).toHaveLength(1);
    expect(validations[0].kind).toBe('setup-severity');
    expect(validations[0].missingFields).toEqual(['Tipo/cor do setup']);
  });

  it('TNL isolada em preparação não vira certeza silenciosa', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 069`);
    expect(snapshot.setups.map((item) => item.tnl)).toContain('TNL 069');
    expect(validations).toHaveLength(1);
    expect(validations[0].kind).toBe('setup-state');
    expect(validations[0].missingFields).toEqual(['Situação do setup', 'Tipo/cor do setup']);
  });

  it('permite confirmar TNL isolada como setup atual com cor', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 069`);
    const updated = applyAssistedValidation(snapshot, validations[0], { setupPlacement: 'active', severity: 'green' });
    expect(updated.setups[0]).toMatchObject({ tnl: 'TNL 069', status: 'active', severity: 'green', shift: 2 });
  });

  it('permite transformar TNL isolada em próximo setup com horário', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 069`);
    const updated = applyAssistedValidation(snapshot, validations[0], { setupPlacement: 'scheduled-current', severity: 'blue', time: '18:45' });
    expect(updated.setups).toHaveLength(0);
    expect(updated.upcomingSetups[0]).toMatchObject({ tnl: 'TNL 069', status: 'scheduled', severity: 'blue', time: '18:45', shift: 2 });
  });

  it('permite transformar TNL isolada em setup do próximo turno', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 069`);
    const updated = applyAssistedValidation(snapshot, validations[0], { setupPlacement: 'scheduled-next', severity: 'red' });
    expect(updated.setups).toHaveLength(0);
    expect(updated.nextShiftSetups[0]).toMatchObject({ tnl: 'TNL 069', status: 'scheduled', severity: 'red', shift: 3 });
  });

  it('próximo setup com cor mas sem horário oferece completar horário', () => {
    const { snapshot, validations } = validate(`*PROXIMOS SETUPS:*\n🔴 TNL 050`);
    expect(snapshot.upcomingSetups.map((item) => item.tnl)).toEqual(['TNL 050']);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ kind: 'setup-time', tnl: 'TNL 050', severity: 'info' });
  });

  it('próximo setup sem cor e sem horário reúne as duas lacunas em uma confirmação', () => {
    const { validations } = validate(`*PROXIMOS SETUPS:*\nTNL 050`);
    expect(validations).toHaveLength(1);
    expect(validations[0].kind).toBe('setup-severity');
    expect(validations[0].missingFields).toEqual(['Tipo/cor do setup', 'Horário']);
  });

  it('após manutenção não exige horário mas exige cor quando ausente', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 087 - Após manutenção\n*MANUTENÇÃO:*\nTNL 087 - Preventiva`);
    expect(snapshot.upcomingSetups.map((item) => item.tnl)).toContain('TNL 087');
    const setupValidation = validations.find((item) => item.tnl === 'TNL 087' && item.kind === 'setup-severity');
    expect(setupValidation?.missingFields).toEqual(['Tipo/cor do setup']);
    expect(validations.some((item) => item.kind === 'setup-time')).toBe(false);
  });

  it('aplica cor em setup já interpretado sem mudar seu estado', () => {
    const { snapshot, validations } = validate(`*PREPARAÇÃO 2° TURNO:*\nTNL 069 - Em setup`);
    const updated = applyAssistedValidation(snapshot, validations[0], { severity: 'blue' });
    expect(updated.setups[0]).toMatchObject({ tnl: 'TNL 069', status: 'active', severity: 'blue' });
  });

  it('aplica horário a próximo setup sem mudar a cor existente', () => {
    const { snapshot, validations } = validate(`*PROXIMOS SETUPS:*\n🔴 TNL 050`);
    const updated = applyAssistedValidation(snapshot, validations[0], { time: '19:20' });
    expect(updated.upcomingSetups[0]).toMatchObject({ tnl: 'TNL 050', severity: 'red', time: '19:20' });
  });

  it('ajuste sem motivo gera confirmação de detalhe', () => {
    const { validations } = validate(`*AJUSTE:*\nTNL 055`);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ kind: 'adjustment-detail', tnl: 'TNL 055', interpretedAs: 'Ajuste' });
  });

  it('ajuste com motivo explícito não gera pergunta inútil', () => {
    const { validations } = validate(`*AJUSTE:*\nTNL 055 - Quebra de ferramenta`);
    expect(validations).toEqual([]);
  });

  it('permite completar o motivo do ajuste no consolidado', () => {
    const { snapshot, validations } = validate(`*AJUSTE:*\nTNL 055`);
    const updated = applyAssistedValidation(snapshot, validations[0], { description: 'Quebra de ferramenta' });
    expect(updated.adjustments[0].description).toBe('Quebra de ferramenta');
  });

  it('manutenção com somente TNL pede detalhe, sem perguntar estado desnecessariamente', () => {
    const { snapshot, validations } = validate(`*MANUTENÇÃO:*\nTNL 060`);
    expect(snapshot.maintenanceStopped.map((item) => item.tnl)).toEqual(['TNL 060']);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ kind: 'maintenance-detail', interpretedAs: 'Manutenção parada' });
  });

  it('manutenção com motivo explícito segue direto', () => {
    const { validations } = validate(`*MANUTENÇÃO:*\nTNL 060 - Curto no empurrador`);
    expect(validations).toEqual([]);
  });

  it('desenvolvimento com TNL isolada sugere completar detalhe', () => {
    const { validations } = validate(`*DESENVOLVIMENTO:*\nTNL 118`);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ kind: 'development-detail', severity: 'info' });
  });

  it('seleção com TNL isolada é considerada informação suficiente', () => {
    const { validations } = validate(`*SELEÇÃO DE ORDENS:*\nTNL 118`);
    expect(validations).toEqual([]);
  });

  it('nome sem tipo em Falta/Atraso pede classificação', () => {
    const { validations } = validate(`*FALTA/ATRASO:*\nCarlos Silva`);
    expect(validations).toHaveLength(1);
    expect(validations[0]).toMatchObject({ kind: 'absence-type', person: 'Carlos Silva', interpretedAs: 'Falta (provisório)' });
  });

  it('atestado explícito não gera confirmação', () => {
    const { validations } = validate(`*FALTA/ATRASO:*\nCarlos Silva - Atestado`);
    expect(validations).toEqual([]);
  });

  it('permite corrigir uma ausência provisória para atraso', () => {
    const { snapshot, validations } = validate(`*FALTA/ATRASO:*\nCarlos Silva`);
    const updated = applyAssistedValidation(snapshot, validations[0], { absenceType: 'delay' });
    expect(updated.absences[0]).toMatchObject({ name: 'Carlos Silva', type: 'delay' });
  });

  it('detecta N/A junto com dado real na mesma seção', () => {
    const { validations } = validate(`*AJUSTE:*\nN/A\nTNL 055 - Quebra de ferramenta`);
    expect(validations.some((item) => item.kind === 'na-with-data' && item.section === 'adjustment')).toBe(true);
  });

  it('não confunde N/A de uma seção com dado real de outra', () => {
    const { validations } = validate(`*AJUSTE:*\nN/A\n*MANUTENÇÃO:*\nTNL 060 - Falha no empurrador`);
    expect(validations.some((item) => item.kind === 'na-with-data')).toBe(false);
  });

  it('preserva origem para o técnico saber quem consultar', () => {
    const raw = message(`*PREPARAÇÃO 2° TURNO:*\nTNL 069 - Em setup`, 'Márcio Teste', '9');
    const snapshot = parseSector(raw, 2, 3);
    const validation = buildAssistedValidations(snapshot)[0];
    const source = snapshot.messages.find((item) => item.id === validation.sourceId);
    expect(source).toMatchObject({ sender: 'Márcio Teste', line: '9' });
  });

  it('rota 3º → 1º com setup explícito do 1º turno e cor não gera falsa pendência', () => {
    const { snapshot, validations } = validate(`*PROXIMOS SETUPS:*\n🔴 TNL 030 - 1°T`, 3, 1);
    expect(snapshot.nextShiftSetups[0]).toMatchObject({ tnl: 'TNL 030', shift: 1, severity: 'red' });
    expect(validations).toEqual([]);
  });

  it('aceita grafia compacta de setup explícito sem criar falso alerta', () => {
    const { validations } = validate(`*PREPARAÇÃO 2° TURNO:*\n🔵TNL069 -EM SETUP`);
    expect(validations).toEqual([]);
  });
});
