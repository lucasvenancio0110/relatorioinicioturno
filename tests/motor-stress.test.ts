import { describe, expect, it } from 'vitest';
import { auditSnapshot } from '../src/engine/audit';
import { extractAllTnls, extractTime, normalizeTnl } from '../src/engine/normalize';
import { parseSector } from '../src/engine/parser';

const msg = (body: string, sender = 'Preparador Teste', line = 5) =>
  `[12/08/2026, 15:00:00] ${sender}: *LINHA ${line} - INÍCIO DE TURNO*\n${body}`;

describe('Motor V2 - bateria ampliada de fábrica', () => {
  it('normaliza grafias comuns de TNL sem perder zeros', () => {
    expect(normalizeTnl('TNL 5')).toBe('TNL 005');
    expect(normalizeTnl('TNL005')).toBe('TNL 005');
    expect(normalizeTnl('TNL N° 087')).toBe('TNL 087');
    expect(normalizeTnl('TNL Nº 143')).toBe('TNL 143');
  });

  it('expande várias máquinas escritas na mesma linha', () => {
    expect(extractAllTnls('TNL 13, 143 - quebra')).toEqual(['TNL 013', 'TNL 143']);
    expect(extractAllTnls('TNL 005, TNL 030')).toEqual(['TNL 005', 'TNL 030']);
  });

  it('interpreta horários usados pelos preparadores', () => {
    expect(extractTime('TNL 99 19:00')).toBe('19:00');
    expect(extractTime('TNL 115 18H30')).toBe('18:30');
    expect(extractTime('TNL 10 - 19 H')).toBe('19:00');
  });

  it('não cria máquinas fantasmas a partir de N/A', () => {
    const snapshot = parseSector(msg(`*PREPARAÇÃO 2° TURNO:*\nN/A\n*AJUSTE:*\n*N/A*\n*MANUTENÇÃO:*\n• N/A`), 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.sourceMachines).toBe(0);
    expect(audit.machines).toBe(0);
    expect(audit.missingMachines).toEqual([]);
  });

  it('classifica setup com horário como próximo setup do turno atual', () => {
    const snapshot = parseSector(msg(`*PREPARAÇÃO 2° TURNO:*\n🔴*TNL* 99     19:00\n🔵 TNL 115 - 18H30`), 2, 3);
    expect(snapshot.setups).toHaveLength(0);
    expect(snapshot.upcomingSetups.map((item) => [item.tnl, item.time])).toEqual([
      ['TNL 099', '19:00'],
      ['TNL 115', '18:30'],
    ]);
  });

  it('aceita rota 3º → 1º e envia setup explícito para o próximo turno escolhido', () => {
    const snapshot = parseSector(msg(`*PROXIMOS SETUPS:*\n🔴 TNL 030 - 1°T`), 3, 1);
    expect(snapshot.currentShift).toBe(3);
    expect(snapshot.nextShift).toBe(1);
    expect(snapshot.nextShiftSetups.map((item) => item.tnl)).toContain('TNL 030');
  });

  it('trata manutenção + próximo setup após manutenção como sobreposição, não contradição', () => {
    const snapshot = parseSector(msg(`*PREPARAÇÃO 2° TURNO:*\n🔵 TNL 087 - Após manutenção\n*MANUTENÇÃO:*\nTNL 087 - Preventiva Bi-anual`), 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.contradictions).toBe(0);
    expect(audit.attentions.find((item) => item.tnl === 'TNL 087')?.kind).toBe('valid-overlap');
    expect(audit.confidence).toBe(100);
  });

  it('trata seleção + desenvolvimento como sobreposição informativa', () => {
    const snapshot = parseSector(msg(`*SELEÇÃO DE ORDENS:*\nTNL 118\n*DESENVOLVIMENTO:*\nTNL 118`), 2, 3);
    const audit = auditSnapshot(snapshot);
    const attention = audit.attentions.find((item) => item.tnl === 'TNL 118');
    expect(attention).toBeDefined();
    expect(attention?.contexts.map((context) => context.key)).toEqual(expect.arrayContaining(['selection', 'development']));
  });

  it('trata ajuste + desenvolvimento como múltiplos contextos que merecem atenção', () => {
    const snapshot = parseSector(msg(`*AJUSTE:*\nTNL 122 - Rebarba\n*DESENVOLVIMENTO:*\nTNL 122 - Teste de processo`), 2, 3);
    const attention = auditSnapshot(snapshot).attentions.find((item) => item.tnl === 'TNL 122');
    expect(attention?.kind).toBe('multi-context');
    expect(attention?.severity).toBe('warning');
  });

  it('eleva setup ativo + manutenção parada para conflito real e não duplica como sobreposição', () => {
    const snapshot = parseSector(msg(`*PREPARAÇÃO 2° TURNO:*\n🔴 TNL 060 - Em Setup\n*MANUTENÇÃO:*\nTNL 060 - Parada por falha`), 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.issues.some((issue) => issue.kind === 'contradiction' && issue.tnl === 'TNL 060')).toBe(true);
    expect(audit.attentions.some((attention) => attention.tnl === 'TNL 060')).toBe(false);
    expect(audit.confidence).toBeLessThan(100);
  });

  it('detecta manutenção parada e produzindo simultaneamente como conflito real', () => {
    const snapshot = parseSector(msg(`*MANUTENÇÃO:*\nTNL 059 - Colisão X2\nTNL 059 - Rodando após intervenção`), 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.contradictions).toBe(1);
    expect(audit.issues.find((issue) => issue.tnl === 'TNL 059')?.severity).toBe('critical');
  });

  it('mantém uma TNL auditável mesmo quando dois preparadores informam a mesma máquina', () => {
    const input = `${msg(`*AJUSTE:*\nTNL 089 - Quebra de ferramenta`, 'Preparador A', 5)}\n${msg(`*AJUSTE:*\nTNL 089 - Quebra de ferramenta`, 'Preparador B', 6)}`;
    const snapshot = parseSector(input, 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.sourceMachines).toBe(1);
    expect(audit.machines).toBe(1);
    expect(audit.missingMachines).toEqual([]);
  });

  it('detecta pessoa classificada em dois tipos de ausência', () => {
    const snapshot = parseSector(msg(`*FALTA/ATRASO:*\nCarlos - Atestado\nCarlos - Férias`), 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.issues.some((issue) => issue.kind === 'contradiction' && issue.message.includes('Carlos'))).toBe(true);
  });

  it('preserva a mesma descrição ao expandir duas TNLs de um ajuste', () => {
    const snapshot = parseSector(msg(`*AJUSTE:*\nTNL 13, 143 - Quebra das ferramentas`), 2, 3);
    expect(snapshot.adjustments.map((item) => item.tnl)).toEqual(['TNL 013', 'TNL 143']);
    expect(snapshot.adjustments.every((item) => item.description === 'Quebra das ferramentas')).toBe(true);
  });

  it('prefere a informação detalhada quando desenvolvimento repete a mesma TNL', () => {
    const snapshot = parseSector(msg(`*DESENVOLVIMENTO:*\nTNL 134\nTNL 134 - Programação`), 2, 3);
    expect(snapshot.development).toHaveLength(1);
    expect(snapshot.development[0]).toMatchObject({ tnl: 'TNL 134', description: 'Programação' });
  });

  it('mantém cobertura de 100% num lote misto sem perda de TNL', () => {
    const snapshot = parseSector(msg(`*PREPARAÇÃO 2° TURNO:*\n🔴 TNL 073 - Em Setup\n*PROXIMOS SETUPS:*\n🔴 TNL 094 - 3°T\n*AJUSTE:*\nTNL 089 - Punção deslocado\n*SELEÇÃO DE ORDENS:*\nTNL 081\n*MANUTENÇÃO:*\nTNL 056 - Index\n*DESENVOLVIMENTO:*\nTNL 142 - Rodando`), 2, 3);
    const audit = auditSnapshot(snapshot);
    expect(audit.sourceMachines).toBe(6);
    expect(audit.machines).toBe(6);
    expect(audit.missingMachines).toEqual([]);
    expect(audit.confidence).toBe(100);
  });
});
