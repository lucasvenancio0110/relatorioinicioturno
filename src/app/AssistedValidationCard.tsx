import { useMemo, useState } from 'react';
import type { AbsenceRecord, AssistedValidation, SectorSnapshot, Severity } from '../domain/types';
import type { AssistedValidationDecision } from '../engine/assistedValidation';

interface Props {
  validation: AssistedValidation;
  snapshot: SectorSnapshot;
  hasNext?: boolean;
  onApply: (decision: AssistedValidationDecision) => void;
  onResolve: () => void;
}

const setupTypes: Array<{ value: Exclude<Severity, null>; label: string; short: string }> = [
  { value: 'red', label: 'Ferramentas + programa', short: '🔴' },
  { value: 'green', label: 'Programa', short: '🟢' },
  { value: 'blue', label: 'Variável / comprimento', short: '🔵' },
];

const absenceTypes: Array<{ value: AbsenceRecord['type']; label: string }> = [
  { value: 'delay', label: 'Atraso' },
  { value: 'absence', label: 'Falta' },
  { value: 'certificate', label: 'Atestado' },
  { value: 'vacation', label: 'Férias' },
  { value: 'leave', label: 'Afastado' },
];

function questionFor(validation: AssistedValidation): string {
  if (validation.kind === 'maintenance-detail' || validation.kind === 'adjustment-detail' || validation.kind === 'development-detail') return 'Qual é o detalhe?';
  if (validation.kind === 'setup-severity') return 'Qual é o tipo do setup?';
  if (validation.kind === 'setup-state') return 'Qual é a situação da máquina?';
  if (validation.kind === 'setup-time') return 'Qual é o horário previsto?';
  if (validation.kind === 'absence-type') return 'Qual é o tipo de ausência?';
  if (validation.kind === 'na-with-data') return 'Os dados informados estão corretos?';
  return 'Confirme a informação';
}

export default function AssistedValidationCard({ validation, snapshot, hasNext = false, onApply, onResolve }: Props) {
  const [selectedSeverity, setSelectedSeverity] = useState<Exclude<Severity, null> | null>(null);
  const [placement, setPlacement] = useState<'active' | 'scheduled-current' | 'scheduled-next' | null>(null);
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [absenceType, setAbsenceType] = useState<AbsenceRecord['type'] | null>(null);
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState(false);

  const source = useMemo(() => snapshot.messages.find((message) => message.id === validation.sourceId), [snapshot.messages, validation.sourceId]);
  const needsSeverity = validation.missingFields.includes('Tipo/cor do setup');
  const needsTime = validation.missingFields.includes('Horário');
  const finalLabel = (base: string) => hasNext ? `${base} e próxima` : base;

  const finish = (decision?: AssistedValidationDecision) => {
    if (resolving) return;
    setResolving(true);
    window.setTimeout(() => {
      if (decision) onApply(decision);
      onResolve();
    }, 180);
  };

  const copyQuestion = async () => {
    const recipient = source?.sender ? ` ${source.sender}${source.line ? ` (Linha ${source.line})` : ''}` : '';
    await navigator.clipboard.writeText(`${recipient ? `Olá${recipient}, s` : 'S'}ó para confirmar: ${validation.question}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const renderSetupSeverity = () => (
    <div className="assist-controls">
      <div className="v9-choice-list setup-type-grid">
        {setupTypes.map((type) => (
          <button
            type="button"
            key={type.value}
            className={selectedSeverity === type.value ? 'selected' : ''}
            onClick={() => setSelectedSeverity(type.value)}
            aria-pressed={selectedSeverity === type.value}
          >
            <span className="v9-radio-dot" />
            <span className="v9-choice-emoji">{type.short}</span>
            <strong>{type.label}</strong>
          </button>
        ))}
      </div>
      {needsTime && (
        <label className="assist-time-field">
          <span>Horário, se houver</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
      )}
      <button className="assist-confirm" type="button" disabled={!selectedSeverity} onClick={() => finish({ severity: selectedSeverity || undefined, time: time || undefined })}>
        {finalLabel('Confirmar')}
      </button>
    </div>
  );

  const renderSetupState = () => {
    const canApply = Boolean(placement) && (!needsSeverity || Boolean(selectedSeverity));
    return (
      <div className="assist-controls">
        <div className="v9-choice-list setup-placement-grid">
          <button type="button" className={placement === 'active' ? 'selected' : ''} onClick={() => setPlacement('active')} aria-pressed={placement === 'active'}><span className="v9-radio-dot"/><strong>Em setup agora</strong></button>
          <button type="button" className={placement === 'scheduled-current' ? 'selected' : ''} onClick={() => setPlacement('scheduled-current')} aria-pressed={placement === 'scheduled-current'}><span className="v9-radio-dot"/><strong>Vai entrar em setup</strong></button>
          <button type="button" className={placement === 'scheduled-next' ? 'selected' : ''} onClick={() => setPlacement('scheduled-next')} aria-pressed={placement === 'scheduled-next'}><span className="v9-radio-dot"/><strong>Setup {snapshot.nextShift}ºT</strong></button>
        </div>
        {placement === 'scheduled-current' && (
          <label className="assist-time-field"><span>Horário, se souber</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        )}
        {needsSeverity && renderSetupSeverityInline(selectedSeverity, setSelectedSeverity)}
        <button className="assist-confirm" type="button" disabled={!canApply} onClick={() => finish({ setupPlacement: placement || undefined, severity: selectedSeverity || undefined, time: time || undefined })}>
          {finalLabel('Confirmar')}
        </button>
      </div>
    );
  };

  const renderDetail = () => (
    <div className="assist-controls">
      <label className="assist-text-field v9-detail-field">
        <input
          autoFocus
          type="text"
          value={description}
          placeholder={validation.kind === 'adjustment-detail' ? 'Ex.: Quebra de ferramenta' : validation.kind === 'maintenance-detail' ? 'Ex.: Falha no empurrador' : 'Ex.: Programação'}
          onChange={(event) => setDescription(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && description.trim()) finish({ description }); }}
        />
      </label>
      <button className="assist-confirm" type="button" disabled={!description.trim()} onClick={() => finish({ description })}>{finalLabel('Salvar')}</button>
    </div>
  );

  const renderAbsence = () => (
    <div className="assist-controls">
      <div className="v9-choice-list absence-choice-grid">
        {absenceTypes.map((type) => (
          <button key={type.value} type="button" className={absenceType === type.value ? 'selected' : ''} onClick={() => setAbsenceType(type.value)} aria-pressed={absenceType === type.value}>
            <span className="v9-radio-dot"/><strong>{type.label}</strong>
          </button>
        ))}
      </div>
      <button className="assist-confirm" type="button" disabled={!absenceType} onClick={() => finish({ absenceType: absenceType || undefined })}>{finalLabel('Confirmar')}</button>
    </div>
  );

  return (
    <article className={`assist-card v9-assist-card ${validation.severity} ${resolving ? 'resolving' : ''}`}>
      {resolving && <div className="assist-success" role="status"><span>✓</span> Resolvido</div>}

      <div className="v9-decision-intro">
        <div><strong>{validation.tnl || validation.title}</strong><span>{validation.interpretedAs}</span></div>
        <h3>{questionFor(validation)}</h3>
      </div>

      {validation.kind === 'setup-severity' && renderSetupSeverity()}
      {validation.kind === 'setup-state' && renderSetupState()}
      {validation.kind === 'setup-time' && (
        <div className="assist-controls assist-time-actions">
          <label className="assist-time-field"><span>Horário</span><input autoFocus type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <button className="assist-confirm" type="button" disabled={!time} onClick={() => finish({ time })}>{finalLabel('Salvar')}</button>
          <button className="assist-secondary" type="button" onClick={() => finish()}>{finalLabel('Sem horário')}</button>
        </div>
      )}
      {(validation.kind === 'maintenance-detail' || validation.kind === 'adjustment-detail' || validation.kind === 'development-detail') && renderDetail()}
      {validation.kind === 'absence-type' && renderAbsence()}
      {validation.kind === 'na-with-data' && <button className="assist-confirm standalone" type="button" onClick={() => finish()}>{finalLabel('Confirmar')}</button>}

      <div className="assist-origin v9-assist-origin">
        <span>{source?.sender || 'Preparador não identificado'}{source?.line ? ` · Linha ${source.line}` : ''}</span>
        <button type="button" onClick={copyQuestion}>{copied ? 'Copiada ✓' : 'Copiar pergunta'}</button>
      </div>
    </article>
  );
}

function renderSetupSeverityInline(selected: Exclude<Severity, null> | null, onSelect: (severity: Exclude<Severity, null>) => void) {
  return (
    <div className="v9-inline-setup-type">
      <span>Tipo do setup</span>
      <div className="v9-choice-list setup-type-grid compact">
        {setupTypes.map((type) => (
          <button type="button" key={type.value} className={selected === type.value ? 'selected' : ''} onClick={() => onSelect(type.value)} aria-pressed={selected === type.value}>
            <span className="v9-radio-dot"/><span className="v9-choice-emoji">{type.short}</span><strong>{type.label}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
