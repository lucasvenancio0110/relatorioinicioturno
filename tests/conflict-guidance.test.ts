import { describe, expect, it } from 'vitest';
import { auditSnapshot } from '../src/engine/audit';
import { getConfirmationInstruction, getConflictContacts, getConflictQuestion } from '../src/engine/conflictGuidance';
import { parseSector } from '../src/engine/parser';

describe('Conflitos com orientação de confirmação', () => {
  it('aponta os preparadores e linhas que deram estados incompatíveis de manutenção', () => {
    const raw = `[11/08/2026, 15:00:00] Preparador Alfa: *LINHA 4 - INÍCIO DE TURNO*\n*MANUTENÇÃO:*\nTNL 060 - Parada por falha\n\n[11/08/2026, 15:03:00] Preparador Beta: *LINHA 5 - INÍCIO DE TURNO*\n*MANUTENÇÃO:*\nTNL 060 - Rodando após intervenção`;
    const snapshot = parseSector(raw, 2);
    const issue = auditSnapshot(snapshot).issues.find((item) => item.id === 'maintenance-state-TNL 060');

    expect(issue).toBeTruthy();
    if (!issue) return;

    expect(getConflictContacts(issue, snapshot).map((item) => `${item.sender}|${item.line}`)).toEqual([
      'Preparador Alfa|Linha 4',
      'Preparador Beta|Linha 5',
    ]);
    expect(getConfirmationInstruction(issue, snapshot)).toContain('Preparador Alfa (Linha 4)');
    expect(getConfirmationInstruction(issue, snapshot)).toContain('Preparador Beta (Linha 5)');
    expect(getConflictQuestion(issue)).toContain('parada em manutenção ou está produzindo');
  });

  it('considera setup ativo + manutenção parada um conflito real', () => {
    const raw = `[11/08/2026, 15:00:00] Preparador Gama: *LINHA 6 - INÍCIO DE TURNO*\n*PREPARAÇÃO 2° TURNO:*\n🔴 TNL 073 - Em Setup\n\n*MANUTENÇÃO:*\nTNL 073 - Parada por falha`;
    const snapshot = parseSector(raw, 2);
    const audit = auditSnapshot(snapshot);
    const issue = audit.issues.find((item) => item.id === 'setup-maintenance-TNL 073');

    expect(issue?.kind).toBe('contradiction');
    expect(issue?.severity).toBe('critical');
    expect(audit.contradictions).toBeGreaterThanOrEqual(1);
    if (issue) expect(getConflictQuestion(issue)).toContain('setup agora ou continua parada em manutenção');
  });
});
