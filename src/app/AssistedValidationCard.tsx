import { useMemo, useState } from 'react';
import type { AbsenceRecord, AssistedValidation, SectorSnapshot, Severity } from '../domain/types';
import type { AssistedValidationDecision } from '../engine/assistedValidation';

interface Props {
  validation: AssistedValidation;
  snapshot: SectorSnapshot;
  onApply: (decision: AssistedValidationDecision) => void;
  onResolve: () => void;
}

const setupTypes: Array<{ value: Exclude<Severity, null>; label: string; short: string }> = [
  { value: 'red', label: '🔴 Ferramentas + programa', short: '🔴' },
  { value: 'green', label: '🟢 Programa', short: '🟢' },
  { value: 'blue', label: '🔵 Variável / comprimento', short: '🔵' },
];

const absenceTypes: Array<{ value: AbsenceRecord['type']; label: string }> = [
  { value: 'delay', label: 'Atraso' },
  { value: 'absence', label: 'Falta' },
  { value: 'certificate', label: 'Atestado' },
  { value: 'vacation', label: 'Férias' },
  { value: 'leave', label: 'Afastado' },
];

export default function AssistedValidationCard({ validation, snapshot, onApply, onResolve }: Props) {
  const [selectedSeverity, setSelectedSeverity] = useState<Exclude<Severity, null> | null>(null);
  const [placement, setPlacement] = useState<'active' | 'scheduled-current' | 'scheduled-next' | null>(null);
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState(false);

  const source = useMemo(() => snapshot.messages.find((message) => message.id === validation.sourceId), [snapshot.messages, validation.sourceId]);
  const needsSeverity = validation.missingFields.includes('Tipo/cor do setup');
  const needsTime = validation.missingFields.includes('Horário');

  const finish = (decision?: AssistedValidationDecision) => {
    if (resolving) return;
    setResolving(true);
    window.setTimeout(() => {
      if (decision) onApply(decision);
      onResolve();
    }, 340);
  };

  const copyQuestion = async () => {
    const recipient = source?.sender ? ` ${source.sender}${source.line ? ` (Linha ${source.line})` : ''}` : '';
    await navigator.clipboard.writeText(`${recipient ? `Olá${recipient}, s` : 'S'}ó para confirmar: ${validation.question}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const renderSetupSeverity = () => (
    <div className="assist-controls">
      <div className="assist-choice-label">Tipo do setup</div>
      <div className="setup-type-grid">
        {setupTypes.map((type) => (
          <button
            type="button"
            key={type.value}
            className={selectedSeverity === type.value ? 'selected' : ''}
            onClick={() => setSelectedSeverity(type.value)}
            title={type.label}
          >
            <span>{type.short}</span><small>{type.label.replace(/^.\s*/, '')}</small>
          </button>
        ))}
      </div>
      {needsTime && (
        <label className="assist-time-field">
          <span>Horário, se houver</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
      )}
      <button
        className="assist-confirm"
        type="button"
        disabled={!selectedSeverity}
        onClick={() => finish({ severity: selectedSeverity || undefined, time: time || undefined })}
      >Confirmar informação</button>
    </div>
  );

  const renderSetupState = () => {
    const canApply = Boolean(placement) && (!needsSeverity || Boolean(selectedSeverity));
    return (
      <div className="assist-controls">
        <div className="assist-choice-label">Situação da máquina</div>
        <div className="setup-placement-grid">
          <button type="button" className={placement === 'active' ? 'selected' : ''} onClick={() => setPlacement('active')}>Em setup agora</button>
          <button type="button" className={placement === 'scheduled-current' ? 'selected' : ''} onClick={() => setPlacement('scheduled-current')}>Vai entrar em setup</button>
          <button type="button" className={placement === 'scheduled-next' ? 'selected' : ''} onClick={() => setPlacement('scheduled-next')}>Setup {snapshot.nextShift}ºT</button>
        </div>
        {placement === 'scheduled-current' && (
          <label className="assist-time-field">
            <span>Horário, se souber</span>
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        )}
        {needsSeverity && renderSetupSeverityInline(selectedSeverity, setSelectedSeverity)}
        <button
          className="assist-confirm"
          type="button"
          disabled={!canApply}
          onClick={() => finish({ setupPlacement: placement || undefined, severity: selectedSeverity || undefined, time: time || undefined })}
        >Aplicar no consolidado</button>
      </div>
    );
  };

  const renderDetail = () => (
    <div className="assist-controls">
      <label className="assist-text-field">
        <span>Completar informação</span>
        <input
          type="text"
          value={description}
          placeholder={validation.kind === 'adjustment-detail' ? 'Ex.: Quebra de ferramenta' : validation.kind === 'maintenance-detail' ? 'Ex.: Falha no empurrador' : 'Ex.: Programação'}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <button className="assist-confirm" type="button" disabled={!description.trim()} onClick={() => finish({ description })}>Salvar detalhe</button>
    </div>
  );

  const renderAbsence = () => (
    <div className="assist-controls">
      <div className="absence-choice-grid">
        {absenceTypes.map((type) => (
          <button key={type.value} type="button" onClick={() => finish({ absenceType: type.value })}>{type.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <article className={`assist-card ${validation.severity} ${resolving ? 'resolving' : ''}`}>
      {resolving && <div className="assist-success"><span>✓</span> Resolvido</div>}
      <div className="assist-head">
        <div>
          <span>CONFIRMAR</span>
          <strong>{validation.title}</strong>
        </div>
        <small>{validation.interpretedAs}</small>
      </div>

      <p>{validation.message}</p>
      <div className="assist-origin">
        <span>{source?.sender || 'Preparador não identificado'}{source?.line ? ` · Linha ${source.line}` : ''}</span>
        <button type="button" onClick={copyQuestion}>{copied ? 'Copiada ✓' : 'Copiar pergunta'}</button>
      </div>

      {validation.kind === 'setup-severity' && renderSetupSeverity()}
      {validation.kind === 'setup-state' && renderSetupState()}
      {validation.kind === 'setup-time' && (
        <div className="assist-controls assist-time-actions">
          <label className="assist-time-field"><span>Horário previsto</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <button className="assist-confirm" type="button" disabled={!time} onClick={() => finish({ time })}>Salvar horário</button>
          <button className="assist-secondary" type="button" onClick={() => finish()}>Sem horário definido</button>
        </div>
      )}
      {(validation.kind === 'maintenance-detail' || validation.kind === 'adjustment-detail' || validation.kind === 'development-detail') && renderDetail()}
      {validation.kind === 'absence-type' && renderAbsence()}
      {validation.kind === 'na-with-data' && <button className="assist-confirm standalone" type="button" onClick={() => finish()}>Confirmar dados reais</button>}
    </article>
  );
}

function renderSetupSeverityInline(
  selected: Exclude<Severity, null> | null,
  onSelect: (severity: Exclude<Severity, null>) => void,
) {
  return (
    <>
      <div className="assist-choice-label">Tipo do setup</div>
      <div className="setup-type-grid compact">
        {setupTypes.map((type) => (
          <button type="button" key={type.value} className={selected === type.value ? 'selected' : ''} onClick={() => onSelect(type.value)}>
            <span>{type.short}</span><small>{type.label.replace(/^.\s*/, '')}</small>
          </button>
        ))}
      </div>
    </>
  );
}
