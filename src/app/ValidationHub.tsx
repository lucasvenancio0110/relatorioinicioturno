import { useMemo, useState } from 'react';
import { Dialog } from 'radix-ui';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleHelp, Layers3, X } from 'lucide-react';
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

type PendingItem = Exclude<ActiveItem, null>;

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

function validationSummary(validation: AssistedValidation): string {
  if (validation.kind === 'maintenance-detail' || validation.kind === 'adjustment-detail' || validation.kind === 'development-detail') {
    return `${validation.interpretedAs} · falta detalhe`;
  }
  if (validation.kind === 'setup-severity') return `${validation.interpretedAs} · falta tipo`;
  if (validation.kind === 'setup-state') return 'Preparação · confirmar situação';
  if (validation.kind === 'setup-time') return `${validation.interpretedAs} · falta horário`;
  if (validation.kind === 'absence-type') return 'Ausência · confirmar tipo';
  if (validation.kind === 'na-with-data') return `${validation.interpretedAs} · conferir dados`;
  return validation.interpretedAs;
}

function attentionSummary(attention: OperationalAttention): string {
  return attention.contexts.map((context) => context.label).join(' + ');
}

function samePendingItem(left: PendingItem, right: PendingItem): boolean {
  return left.kind === right.kind && left.id === right.id;
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
  const pendingItems = useMemo<PendingItem[]>(() => [
    ...issues.map((item) => ({ kind: 'issue' as const, id: item.id })),
    ...validations.map((item) => ({ kind: 'validation' as const, id: item.id })),
    ...attentions.map((item) => ({ kind: 'attention' as const, id: item.id })),
  ], [issues, validations, attentions]);
  const pendingCount = pendingItems.length;

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

  const activeIndex = active ? pendingItems.findIndex((item) => samePendingItem(item, active)) : -1;
  const nextPending = activeIndex >= 0 ? (pendingItems[activeIndex + 1] ?? null) : null;
  const hasNext = Boolean(nextPending);
  const finishCurrent = () => setActive(nextPending);

  return (
    <section className="validation-hub v8-validation v9-validation" aria-label="Validação do setor">
      <div className="validation-hub-head">
        <h2>Validação</h2>
        <div className={pendingCount ? 'validation-count pending' : 'validation-count clear'}>
          {pendingCount ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <strong>{pendingCount}</strong>
        </div>
      </div>

      {pendingCount === 0 ? (
        <div className="validation-clear-state">
          <CheckCircle2 size={17} />
          <strong>Sem pendências</strong>
          {resolvedCount > 0 && <small>{resolvedCount} resolvida(s)</small>}
        </div>
      ) : (
        <div className="validation-queue">
          {issues.map((issue) => (
            <button key={`issue-${issue.id}`} type="button" className="validation-row critical" onClick={() => setActive({ kind: 'issue', id: issue.id })}>
              <span className="validation-row-icon"><AlertTriangle size={17} /></span>
              <span className="validation-row-copy"><strong>{issue.tnl || 'Revisão necessária'}</strong><em>Conflito · {issue.message}</em></span>
              <span className="validation-row-action"><small>Revisar</small><ChevronRight size={17}/></span>
            </button>
          ))}

          {validations.map((validation) => (
            <button key={`validation-${validation.id}`} type="button" className="validation-row confirm" onClick={() => setActive({ kind: 'validation', id: validation.id })}>
              <span className="validation-row-icon"><CircleHelp size={17} /></span>
              <span className="validation-row-copy"><strong>{validation.tnl || validation.title}</strong><em>{validationSummary(validation)}</em></span>
              <span className="validation-row-action"><small>Confirmar</small><ChevronRight size={17}/></span>
            </button>
          ))}

          {attentions.map((attention) => (
            <button key={`attention-${attention.id}`} type="button" className="validation-row overlap" onClick={() => setActive({ kind: 'attention', id: attention.id })}>
              <span className="validation-row-icon"><Layers3 size={17} /></span>
              <span className="validation-row-copy"><strong>{attention.tnl}</strong><em>{attentionSummary(attention)}</em></span>
              <span className="validation-row-action"><small>Revisar</small><ChevronRight size={17}/></span>
            </button>
          ))}
        </div>
      )}

      <Dialog.Root open={Boolean(active)} onOpenChange={(open) => { if (!open) setActive(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="decision-sheet-overlay" />
          <Dialog.Content className="decision-sheet v9-decision-sheet" aria-describedby={undefined}>
            <div className="decision-sheet-handle" />
            <div className="decision-sheet-head">
              <div className="v9-sheet-title"><Dialog.Title>Resolver</Dialog.Title>{activeIndex >= 0 && pendingCount > 1 && <span>{activeIndex + 1}/{pendingCount}</span>}</div>
              <Dialog.Close asChild><button type="button" className="decision-sheet-close" aria-label="Fechar"><X size={19} /></button></Dialog.Close>
            </div>
            <div className="decision-sheet-body">
              {activeValidation && (
                <AssistedValidationCard
                  validation={activeValidation}
                  snapshot={snapshot}
                  hasNext={hasNext}
                  onApply={(decision) => onApplyValidation(activeValidation, decision)}
                  onResolve={() => {
                    onResolveValidation(activeValidation.id);
                    finishCurrent();
                  }}
                />
              )}
              {activeIssue && <ConflictCard issue={activeIssue} snapshot={snapshot} />}
              {activeAttention && (
                <OperationalAttentionCard
                  attention={activeAttention}
                  snapshot={snapshot}
                  resolved={false}
                  hasNext={hasNext}
                  onApply={(decision) => {
                    onApplyAttention(activeAttention, decision);
                    finishCurrent();
                  }}
                  onValidate={() => {
                    onValidateAttention(activeAttention.id);
                    finishCurrent();
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
