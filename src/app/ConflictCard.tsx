import { useState } from 'react';
import { Copy, TriangleAlert } from 'lucide-react';
import type { AuditIssue, SectorSnapshot } from '../domain/types';
import { getConfirmationInstruction, getConflictContacts, getConflictQuestion } from '../engine/conflictGuidance';

export default function ConflictCard({ issue, snapshot }: { issue: AuditIssue; snapshot: SectorSnapshot }) {
  const [copied, setCopied] = useState(false);
  const contacts = getConflictContacts(issue, snapshot);
  const question = getConflictQuestion(issue);
  const instruction = getConfirmationInstruction(issue, snapshot);
  const typeLabel = issue.kind === 'contradiction'
    ? 'Conflito real'
    : issue.kind === 'missing-machine'
      ? 'Informação não consolidada'
      : 'Interpretação pendente';

  const copyQuestion = async () => {
    await navigator.clipboard.writeText(question);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <article className={`attention-card conflict ${issue.severity}`}>
      <div className="attention-card-head">
        <div>
          <span className="attention-type"><TriangleAlert size={14} strokeWidth={2.4} /> {typeLabel}</span>
          <strong>{issue.tnl || 'Revisão necessária'}</strong>
        </div>
        <span className="attention-status">{issue.severity === 'critical' ? 'Confirmar' : 'Revisar'}</span>
      </div>
      <p>{issue.message}</p>

      {contacts.length > 0 && (
        <div className="attention-sources">
          <span>Origem</span>
          <div>
            {contacts.map((contact) => (
              <small key={`${contact.sourceId}-${contact.line}`}><strong>{contact.sender}</strong> · {contact.line}{contact.timestamp ? ` · ${contact.timestamp}` : ''}</small>
            ))}
          </div>
        </div>
      )}

      <div className="attention-action-box">
        <div>
          <span>Pergunta sugerida</span>
          <strong>{question}</strong>
          <small>{instruction}</small>
        </div>
        <button type="button" onClick={copyQuestion}><Copy size={15} /> {copied ? 'Copiada ✓' : 'Copiar pergunta'}</button>
      </div>
    </article>
  );
}
