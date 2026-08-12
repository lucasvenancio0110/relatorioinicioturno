import { useState } from 'react';
import type { OperationalAttention, SectorSnapshot } from '../domain/types';
import { getContextDescription, type AttentionDecision } from '../engine/attentionResolution';

interface OperationalAttentionCardProps {
  attention: OperationalAttention;
  snapshot: SectorSnapshot;
  resolved: boolean;
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
  onApply,
  onValidate,
  onReopen,
}: OperationalAttentionCardProps) {
  const [editing, setEditing] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(attention.contexts.map((context) => context.key));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const contacts = sourceContacts(attention, snapshot);
  const label = attention.kind === 'valid-overlap' ? 'Sobreposição' : 'Múltiplos contextos';

  const beginEdit = () => {
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

  const saveEdit = () => {
    onApply({ selectedContextKeys: selectedKeys, descriptions: drafts });
    setEditing(false);
  };

  if (resolved) {
    return (
      <article className={`attention-card overlap resolved ${attention.severity}`}>
        <div className="resolved-attention-main">
          <div>
            <span className="attention-type">Validado</span>
            <strong>{attention.tnl}</strong>
          </div>
          <span className="resolved-contexts">{attention.contexts.map((context) => context.label).join(' + ')}</span>
        </div>
        <button className="attention-reopen" type="button" onClick={onReopen}>Revisar</button>
      </article>
    );
  }

  return (
    <article className={`attention-card overlap decision ${attention.severity} ${editing ? 'editing' : ''}`}>
      <div className="attention-card-head compact-attention-head">
        <div>
          <span className="attention-type">{label}</span>
          <strong>{attention.tnl}</strong>
        </div>
        <span className="attention-status">Decidir</span>
      </div>

      {!editing ? (
        <>
          <div className="compact-context-stack">
            {attention.contexts.map((context) => (
              <div className="compact-context-row" key={context.key}>
                <span>{context.label}</span>
                <strong>{context.detail || 'Sem detalhe'}</strong>
              </div>
            ))}
          </div>

          {contacts.length > 0 && (
            <div className="compact-source-line">
              <span>Informado por</span>
              <strong>{contacts.map((contact) => `${contact.sender} · ${contact.line}`).join(' / ')}</strong>
            </div>
          )}

          <div className="attention-decision-actions">
            <button type="button" className="keep-all" onClick={onValidate}>
              {attention.contexts.length === 2 ? 'Manter nos dois' : 'Manter em todos'}
            </button>
            {attention.contexts.map((context) => (
              <button key={context.key} type="button" onClick={() => onApply({ selectedContextKeys: [context.key] })}>
                Só {shortContextLabel(context.label)}
              </button>
            ))}
            <button type="button" className="edit-attention" onClick={beginEdit}>Editar</button>
          </div>
        </>
      ) : (
        <div className="attention-inline-editor">
          <div className="attention-editor-hint">
            <strong>Onde a {attention.tnl} deve aparecer?</strong>
            <span>Deixe pelo menos um contexto marcado e ajuste o texto se precisar.</span>
          </div>

          <div className="attention-editor-contexts">
            {attention.contexts.map((context) => {
              const selected = selectedKeys.includes(context.key);
              return (
                <div className={selected ? 'attention-editor-row selected' : 'attention-editor-row'} key={context.key}>
                  <button type="button" className="context-check" onClick={() => toggleContext(context.key)} aria-pressed={selected}>
                    {selected ? '✓' : ''}
                  </button>
                  <div>
                    <label>{context.label}</label>
                    <input
                      type="text"
                      value={drafts[context.key] ?? ''}
                      disabled={!selected}
                      placeholder="Sem detalhe adicional"
                      onChange={(event) => setDrafts((current) => ({ ...current, [context.key]: event.target.value }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="attention-editor-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
            <button type="button" className="save-attention" onClick={saveEdit}>Aplicar no consolidado</button>
          </div>
        </div>
      )}
    </article>
  );
}
