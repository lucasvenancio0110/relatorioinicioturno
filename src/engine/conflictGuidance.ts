import type { AuditIssue, SectorSnapshot, SourceMessage } from '../domain/types';

export interface ConflictContact {
  sourceId: string;
  sender: string;
  line: string;
  timestamp?: string;
}

function contactFromMessage(message: SourceMessage): ConflictContact {
  return {
    sourceId: message.id,
    sender: message.sender || 'Preparador não identificado',
    line: message.line ? `Linha ${message.line}` : 'Linha não identificada',
    timestamp: message.timestamp,
  };
}

export function getConflictContacts(issue: AuditIssue, snapshot: SectorSnapshot): ConflictContact[] {
  const wanted = new Set(issue.sourceIds || []);
  if (!wanted.size) return [];

  return snapshot.messages
    .filter((message) => wanted.has(message.id))
    .map(contactFromMessage)
    .filter((contact, index, all) => all.findIndex((item) => item.sender === contact.sender && item.line === contact.line) === index);
}

export function getConflictQuestion(issue: AuditIssue): string {
  if (issue.id.startsWith('maintenance-state-')) {
    return `Só para confirmar a ${issue.tnl || 'máquina'}: ela está parada em manutenção ou está produzindo?`;
  }
  if (issue.id.startsWith('setup-maintenance-')) {
    return `Só para confirmar a ${issue.tnl || 'máquina'}: ela está em setup agora ou continua parada em manutenção?`;
  }
  if (issue.id.startsWith('absence-state-')) {
    return 'Só para confirmar: qual é a classificação correta dessa ausência no início do turno?';
  }
  if (issue.kind === 'missing-machine') {
    return `Só para confirmar a ${issue.tnl || 'máquina'}: qual é a situação atual dela para o relatório de início de turno?`;
  }
  return 'Só para confirmar: qual é a informação correta para o relatório de início de turno?';
}

export function getConfirmationInstruction(issue: AuditIssue, snapshot: SectorSnapshot): string {
  const contacts = getConflictContacts(issue, snapshot);
  if (!contacts.length) {
    return 'Confirme com o preparador responsável pela linha antes de finalizar o relatório.';
  }

  const labels = contacts.map((contact) => `${contact.sender} (${contact.line})`);
  if (labels.length === 1) {
    return `Confirme com ${labels[0]} antes de finalizar o relatório.`;
  }

  const last = labels.pop();
  return `Confirme a informação entre ${labels.join(', ')} e ${last} antes de finalizar o relatório.`;
}
