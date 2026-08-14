import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Dialog } from 'radix-ui';
import { AlertTriangle, CheckCircle2, CircleHelp, Layers3, X } from 'lucide-react';
import type { AssistedValidation, AuditIssue, OperationalAttention, SectorSnapshot } from '../domain/types';
import type { AssistedValidationDecision } from '../engine/assistedValidation';
import type { AttentionDecision } from '../engine/attentionResolution';
import AssistedValidationCard from './AssistedValidationCard';
import ConflictCard from './ConflictCard';
import OperationalAttentionCard from './OperationalAttentionCard';

type ActiveItem =
  | { kind: 'validation'; id: string }
  | { kind: 'issue'; id: string }
  | { kind: 'attention'; id: string }
  | null;

interface Props {
  snapshot: SectorSnapshot;
  validations: AssistedValidation[];
  issues: AuditIssue[];
  attentions: OperationalAttention[];
  resolvedCount: number;
  onApplyValidation: (validation: AssistedValidation, decision: AssistedValidationDecision) => void;
  onResolveValidation: (validationId: string) => void;
  onApplyAttention: (attention: OperationalAttention, decision: AttentionDecision) => void;
  onValidateAttention: (attentionId: string) => void;
  onReopenAttention: (attentionId: string) => void;
}

function shortValidationMessage(validation: AssistedValidation): string {
  if (validation.tnl) return `${validation.tnl} · ${validation.interpretedAs}`;
  return validation.title;
}

function attentionSummary(attention: OperationalAttention): string {
  return attention.contexts.map((context) => context.label).join(' + ');
}

export default function ValidationHub({
  snapshot,
  validations,
  issues,
  attentions,
  resolvedCount,
  onApplyValidation,
  onResolveValidation,
  onApplyAttention,
  onValidateAttention,
  onReopenAttention,
}: Props) {
  const [active, setActive] = useState<ActiveItem>(null);
  const pendingCount = validations.length + issues.length + attentions.length;

  const activeValidation = useMemo(
    () => active?.kind === 'validation' ? validations.find((item) => item.id === active.id) : undefined,
    [active, validations],
  );
  const activeIssue = useMemo(
    () => active?.kind === 'issue' ? issues.find((item) => item.id === active.id) : undefined,
    [active, issues],
  );
  const activeAttention = useMemo(
    () => active?.kind === 'attention' ? attentions.find((item) => item.id === active.id) : undefined,
    [active, attentions],
  );

  return (
    <section className="validation-hub" aria-label="Validação do setor">
      <div className="validation-hub-head">
        <div>
          <span className="section-kicker">VALIDAÇÃO</span>
          <h2>O que precisa de você</h2>
        </div>
        <div className={pendingCount ? 'validation-count pending' : 'validation-count clear'}>
          {pendingCount ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <strong>{pendingCount}</strong>
        </div>
      </div>

      {pendingCount === 0 ? (
        <div className="validation-clear-state">
          <CheckCircle2 size={18} />
          <div><strong>Sem pendências</strong><span>O consolidado está pronto para revisão.</span></div>
          {resolvedCount > 0 && <small>{resolvedCount} decisão(ões) já resolvida(s)</small>}
        </div>
      ) : (
        <div className="validation-queue">
          <AnimatePresence initial={false} mode="popLayout">
            {issues.map((issue) => (
              <motion.button
                layout
                exit={{ opacity: 0, scale: 0.98 }}
                key={`issue-${issue.id}`}
                type="button"
                className="validation-row critical"
                onClick={() => setActive({ kind: 'issue', id: issue.id })}
              >
                <span className="validation-row-icon"><AlertTriangle size={17} /></span>
                <span className="validation-row-copy"><small>CONFLITO</small><strong>{issue.tnl || 'Revisão necessária'}</strong><em>{issue.message}</em></span>
                <span className="validation-row-action">Abrir</span>
              </motion.button>
            ))}

            {validations.map((validation) => (
              <motion.button
                layout
                exit={{ opacity: 0, scale: 0.98 }}
                key={`validation-${validation.id}`}
                type="button"
                className="validation-row confirm"
                onClick={() => setActive({ kind: 'validation', id: validation.id })}
              >
                <span className="validation-row-icon"><CircleHelp size={17} /></span>
                <span className="validation-row-copy"><small>CONFIRMAR</small><strong>{shortValidationMessage(validation)}</strong><em>{validation.message}</em></span>
                <span className="validation-row-action">Resolver</span>
              </motion.button>
            ))}

            {attentions.map((attention) => (
              <motion.button
                layout
                exit={{ opacity: 0, scale: 0.98 }}
                key={`attention-${attention.id}`}
                type="button"
                className="validation-row overlap"
                onClick={() => setActive({ kind: 'attention', id: attention.id })}
              >
                <span className="validation-row-icon"><Layers3 size={17} /></span>
                <span className="validation-row-copy"><small>SOBREPOSIÇÃO</small><strong>{attention.tnl}</strong><em>{attentionSummary(attention)}</em></span>
                <span className="validation-row-action">Decidir</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {resolvedCount > 0 && pendingCount > 0 && (
        <div className="validation-resolved-note"><CheckCircle2 size={14} /> {resolvedCount} resolvida(s) nesta análise</div>
      )}

      <Dialog.Root open={Boolean(active)} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="decision-sheet-overlay" />
          <Dialog.Content className="decision-sheet" aria-describedby={undefined}>
            <div className="decision-sheet-handle" />
            <div className="decision-sheet-head">
              <div><span>DECISÃO OPERACIONAL</span><Dialog.Title>Resolver pendência</Dialog.Title></div>
              <Dialog.Close asChild><button type="button" className="decision-sheet-close" aria-label="Fechar"><X size={19} /></button></Dialog.Close>
            </div>
            <div className="decision-sheet-body">
              {activeValidation && (
                <AssistedValidationCard
                  validation={activeValidation}
                  snapshot={snapshot}
                  onApply={(decision) => onApplyValidation(activeValidation, decision)}
                  onResolve={() => {
                    onResolveValidation(activeValidation.id);
                    setActive(null);
                  }}
                />
              )}
              {activeIssue && <ConflictCard issue={activeIssue} snapshot={snapshot} />}
              {activeAttention && (
                <OperationalAttentionCard
                  attention={activeAttention}
                  snapshot={snapshot}
                  resolved={false}
                  onApply={(decision) => {
                    onApplyAttention(activeAttention, decision);
                    setActive(null);
                  }}
                  onValidate={() => {
                    onValidateAttention(activeAttention.id);
                    setActive(null);
                  }}
                  onReopen={() => onReopenAttention(activeAttention.id)}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
