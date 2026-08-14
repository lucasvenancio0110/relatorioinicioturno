import { useState } from 'react';
import type { OperationalAttention, SectorSnapshot } from '../domain/types';
import { getContextDescription, type AttentionDecision } from '../engine/attentionResolution';

interface OperationalAttentionCardProps {
  attention: OperationalAttention;
  snapshot: SectorSnapshot;
  resolved: boolean;
  hasNext?: boolean;
  onApply: (decision: AttentionDecision) => void;
  onValidate: () => void;
  onReopen: () => void;
}

function sourceContacts(attention: OperationalAttention, snapshot: SectorSnapshot) {
  const wanted = new Set(attention.sourceIds);
  return snapshot.messages
    .filter((message) => wanted.has(message.id))
    .map((message) => ({
      id: message.id,
      sender: message.sender || 'Preparador não identificado',
      line: message.line ? `Linha ${message.line}` : 'Linha não identificada',
    }))
    .filter((contact, index, all) => all.findIndex((item) => item.sender === contact.sender && item.line === contact.line) === index);
}

function shortContextLabel(label: string): string {
  return label
    .replace('Manutenção parada', 'manutenção')
    .replace('Manutenção produzindo', 'manutenção produzindo')
    .replace('Setup atual', 'setup atual')
    .replace('Próximo setup', 'próximo setup')
    .replace('Seleção de ordem', 'seleção')
    .toLowerCase();
}

export default function OperationalAttentionCard({
  attention,
  snapshot,
  resolved,
  hasNext = false,
  onApply,
  onValidate,
  onReopen,
}: OperationalAttentionCardProps) {
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [choice, setChoice] = useState<'all' | string>('all');
  const [selectedKeys, setSelectedKeys] = useState<string[]>(attention.contexts.map((context) => context.key));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const contacts = sourceContacts(attention, snapshot);
  const isSuggestedAll = attention.kind === 'valid-overlap';

  const beginEdit = () => {
    if (resolving) return;
    setSelectedKeys(attention.contexts.map((context) => context.key));
    setDrafts(Object.fromEntries(attention.contexts.map((context) => [context.key, getContextDescription(snapshot, context.key, attention.tnl)])));
    setEditing(true);
  };

  const toggleContext = (key: string) => {
    setSelectedKeys((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  };

  const finishWithSuccess = (action: () => void) => {
    if (resolving) return;
    setResolving(true);
    window.setTimeout(action, 180);
  };

  const confirmChoice = () => {
    if (choice === 'all') finishWithSuccess(onValidate);
    else finishWithSuccess(() => onApply({ selectedContextKeys: [choice] }));
  };

  const saveEdit = () => {
    finishWithSuccess(() => {
      onApply({ selectedContextKeys: selectedKeys, descriptions: drafts });
      setEditing(false);
    });
  };

  if (resolved) {
    return (
      <article className={`attention-card overlap resolved ${attention.severity}`}>
        <div className="resolved-attention-main">
          <div><span className="attention-type">Resolvido ✓</span><strong>{attention.tnl}</strong></div>
          <span className="resolved-contexts">{attention.contexts.map((context) => context.label).join(' + ')}</span>
        </div>
        <button className="attention-reopen" type="button" onClick={onReopen}>Revisar</button>
      </article>
    );
  }

  return (
    <article className={`attention-card overlap decision v9-attention-card ${attention.severity} ${editing ? 'editing' : ''} ${resolving ? 'resolving' : ''}`}>
      {resolving && <div className="decision-success-flash" role="status"><span>✓</span> Resolvido</div>}

      {!editing ? (
        <>
          <div className="v9-decision-intro v9-overlap-intro">
            <div><strong>{attention.tnl}</strong><span>{attention.contexts.length} contextos encontrados</span></div>
          </div>

          <div className="v9-context-list">
            {attention.contexts.map((context) => (
              <div className="v9-context-item" key={context.key}>
                <span>{context.label}</span>
                <strong>{context.detail || 'Sem detalhe'}</strong>
              </div>
            ))}
          </div>

          <div className="v9-decision-question">
            <h3>O que está correto?</h3>
            {isSuggestedAll && <span className="v9-suggestion">Sugestão: manter os dois</span>}
          </div>

          <div className="v9-choice-list v9-overlap-choices" role="radiogroup" aria-label={`Decisão para ${attention.tnl}`}>
            <button type="button" className={choice === 'all' ? 'selected' : ''} aria-pressed={choice === 'all'} onClick={() => setChoice('all')}>
              <span className="v9-radio-dot"/><span><strong>{attention.contexts.length === 2 ? 'Manter nos dois' : 'Manter em todos'}</strong><small>Os contextos coexistem e continuam no relatório.</small></span>
            </button>
            {attention.contexts.map((context) => (
              <button key={context.key} type="button" className={choice === context.key ? 'selected' : ''} aria-pressed={choice === context.key} onClick={() => setChoice(context.key)}>
                <span className="v9-radio-dot"/><span><strong>Só {shortContextLabel(context.label)}</strong></span>
              </button>
            ))}
          </div>

          <div className="v9-decision-footer">
            <button type="button" className="v9-edit-link" disabled={resolving} onClick={beginEdit}>Editar informações</button>
            <button type="button" className="v9-confirm-decision" disabled={resolving} onClick={confirmChoice}>{hasNext ? 'Confirmar e próxima' : 'Confirmar decisão'}</button>
          </div>

          {contacts.length > 0 && <div className="compact-source-line v9-source-line"><span>Origem</span><strong>{contacts.map((contact) => `${contact.sender} · ${contact.line}`).join(' / ')}</strong></div>}
        </>
      ) : (
        <div className="attention-inline-editor v9-attention-editor">
          <div className="attention-editor-hint"><strong>Editar informações</strong><span>Marque onde a {attention.tnl} deve aparecer e ajuste o texto.</span></div>

          <div className="attention-editor-contexts">
            {attention.contexts.map((context) => {
              const selected = selectedKeys.includes(context.key);
              return (
                <div className={selected ? 'attention-editor-row selected' : 'attention-editor-row'} key={context.key}>
                  <button type="button" className="context-check" disabled={resolving} onClick={() => toggleContext(context.key)} aria-pressed={selected}>{selected ? '✓' : ''}</button>
                  <div><label>{context.label}</label><input type="text" value={drafts[context.key] ?? ''} disabled={!selected || resolving} placeholder="Sem detalhe adicional" onChange={(event) => setDrafts((current) => ({ ...current, [context.key]: event.target.value }))}/></div>
                </div>
              );
            })}
          </div>

          <div className="attention-editor-actions"><button type="button" disabled={resolving} onClick={() => setEditing(false)}>Cancelar</button><button type="button" className="save-attention" disabled={resolving} onClick={saveEdit}>{hasNext ? 'Salvar e próxima' : 'Salvar alterações'}</button></div>
        </div>
      )}
    </article>
  );
}
