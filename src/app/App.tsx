import { useMemo, useRef, useState } from 'react';
import type { AuditIssue, ManualCounters, SectorSnapshot, Shift } from '../domain/types';
import { auditSnapshot } from '../engine/audit';
import { getConfirmationInstruction, getConflictContacts, getConflictQuestion } from '../engine/conflictGuidance';
import { parseSector } from '../engine/parser';
import { generateCompactReport, generateFullReport } from '../engine/reports';
import { demoInput } from '../features/demo';
import ReportEditor from './ReportEditor';

const initialCounters: ManualCounters = {
  checkpoint: 0,
  cqMachining: 0,
  cqClosing: 0,
  cqReinspection: 0,
  selectionShift1: 0,
  selectionShift2: 0,
  selectionShift3: 0,
  selectionAll: 0,
  selectionTnc: 0,
};

const counterLabels: Array<[keyof ManualCounters, string]> = [
  ['checkpoint', 'Check Point'],
  ['cqMachining', 'CQ Usinagem'],
  ['cqClosing', 'CQ Fechamento'],
  ['cqReinspection', 'CQ Reinspeção'],
  ['selectionShift1', 'Seleção 1ºT'],
  ['selectionShift2', 'Seleção 2ºT'],
  ['selectionShift3', 'Seleção 3ºT'],
  ['selectionAll', 'Os 3 turnos'],
  ['selectionTnc', 'Seleção TNC'],
];

const nextShiftFor = (shift: Shift): Shift => (shift === 3 ? 1 : ((shift + 1) as Shift));

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="counter-card">
      <div>
        <span className="counter-label">{label}</span>
        <strong>{value || 'N/A'}</strong>
      </div>
      <div className="counter-actions">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function ConflictCard({ issue, snapshot }: { issue: AuditIssue; snapshot: SectorSnapshot }) {
  const [copied, setCopied] = useState(false);
  const contacts = getConflictContacts(issue, snapshot);
  const question = getConflictQuestion(issue);
  const instruction = getConfirmationInstruction(issue, snapshot);
  const typeLabel = issue.kind === 'contradiction' ? 'Conflito' : issue.kind === 'missing-machine' ? 'Informação não consolidada' : 'Revisar interpretação';

  const copyQuestion = async () => {
    await navigator.clipboard.writeText(question);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <article className={`conflict-card ${issue.severity}`}>
      <div className="conflict-card-head">
        <div>
          <span className="conflict-type">{issue.severity === 'critical' ? '⚠ ' : ''}{typeLabel}</span>
          <strong>{issue.tnl || 'Confirmação necessária'}</strong>
        </div>
        <span className="conflict-severity">{issue.severity === 'critical' ? 'Confirmar antes de enviar' : 'Revisar'}</span>
      </div>

      <p className="conflict-explanation">{issue.message}</p>

      <div className="conflict-source-area">
        <span>Quem deve ser consultado</span>
        {contacts.length ? (
          <div className="conflict-contacts">
            {contacts.map((contact) => (
              <div className="conflict-contact" key={`${contact.sourceId}-${contact.line}`}>
                <strong>{contact.sender}</strong>
                <span>{contact.line}</span>
                {contact.timestamp && <small>{contact.timestamp}</small>}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-source-contact">O preparador/linha não pôde ser identificado automaticamente. Confirme com o responsável pelo setor informado.</p>
        )}
      </div>

      <div className="confirmation-script">
        <div>
          <span>Pergunta sugerida</span>
          <strong>{question}</strong>
          <small>{instruction}</small>
        </div>
        <button type="button" onClick={copyQuestion}>{copied ? 'Copiada ✓' : 'Copiar pergunta'}</button>
      </div>
    </article>
  );
}

export default function App() {
  const [raw, setRaw] = useState('');
  const [shift, setShift] = useState<Shift>(2);
  const [snapshot, setSnapshot] = useState<SectorSnapshot | null>(null);
  const [counters, setCounters] = useState<ManualCounters>(initialCounters);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const resultRef = useRef<HTMLElement | null>(null);

  const audit = useMemo(() => (snapshot ? auditSnapshot(snapshot) : null), [snapshot]);
  const fullReport = useMemo(() => (snapshot ? generateFullReport(snapshot, counters) : ''), [snapshot, counters]);
  const compactReport = useMemo(() => (snapshot ? generateCompactReport(snapshot) : ''), [snapshot]);
  const rawLineCount = raw.trim() ? raw.trim().split('\n').length : 0;
  const nextShift = nextShiftFor(shift);

  const analyzeForShift = (selectedShift: Shift, shouldScroll = true) => {
    if (!raw.trim()) return;
    const parsed = parseSector(raw, selectedShift);
    setSnapshot(parsed);
    setAnalysisVersion((version) => version + 1);
    if (shouldScroll) {
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

  const analyze = () => analyzeForShift(shift);

  const selectShift = (selectedShift: Shift) => {
    setShift(selectedShift);
    if (raw.trim() && snapshot) analyzeForShift(selectedShift, false);
  };

  const clearInput = () => {
    setRaw('');
    setSnapshot(null);
    setCounters(initialCounters);
    setAnalysisVersion((version) => version + 1);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">R</div>
          <div>
            <span className="eyebrow">RELATÓRIO INICIAL</span>
            <h1>Início de turno</h1>
          </div>
        </div>
        <div className="status-chip"><span /> Local</div>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-kicker">Consolidado do setor</span>
          <h2>Cole. Analise. Envie.</h2>
          <p>As mensagens dos preparadores viram um consolidado confiável e dois relatórios prontos para o WhatsApp.</p>
        </div>

        <div className="shift-route" aria-label="Fluxo de turnos">
          <div className="shift-current-card">
            <span>Turno atual</span>
            <div className="shift-control">
              {[1, 2, 3].map((item) => (
                <button key={item} type="button" className={shift === item ? 'active' : ''} onClick={() => selectShift(item as Shift)}>{item}º</button>
              ))}
            </div>
          </div>
          <div className="shift-route-arrow" aria-hidden="true">→</div>
          <div className="next-shift-card">
            <span>Próximo turno</span>
            <strong>{nextShift}º</strong>
            <small>automático</small>
          </div>
        </div>
      </section>

      <section className="panel intake-panel">
        <div className="panel-head">
          <div><span className="step-index">01</span><h3>Mensagens dos preparadores</h3></div>
          <div className="head-actions">
            {raw && <button className="text-action muted-action" type="button" onClick={clearInput}>Limpar</button>}
            <button className="text-action" type="button" onClick={() => setRaw(demoInput)}>Demonstração</button>
          </div>
        </div>
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder="Cole aqui todas as mensagens copiadas do WhatsApp..."
          aria-label="Mensagens dos preparadores"
        />
        <div className="intake-footer">
          <div className="intake-status">
            <span className={rawLineCount ? 'live-dot active' : 'live-dot'} />
            <span>{rawLineCount ? `${rawLineCount} linhas capturadas` : 'Aguardando mensagens'}</span>
          </div>
          <button className="primary-button" type="button" onClick={analyze} disabled={!raw.trim()}>
            {snapshot ? 'Reanalisar setor' : 'Analisar setor'} <span>→</span>
          </button>
        </div>
      </section>

      {snapshot && audit && (
        <section className="analysis-stack" ref={resultRef}>
          <div className="engine-strip">
            <div className="engine-status">
              <span className={audit.review ? 'engine-icon warning' : 'engine-icon'}>{audit.review ? '!' : '✓'}</span>
              <div>
                <strong>Motor V2 concluído</strong>
                <small>{audit.review ? `${audit.review} item(ns) precisam de confirmação` : 'Consolidado íntegro, sem perda silenciosa'}</small>
              </div>
            </div>
            <div className="engine-summary-right">
              <div className="shift-inline"><span>Turnos</span><strong>{snapshot.currentShift}º → {snapshot.nextShift}º</strong></div>
              <div className="confidence-inline">
                <span>Confiança</span>
                <strong>{audit.confidence}%</strong>
                <small>{audit.machines}/{audit.sourceMachines || audit.machines} TNLs cobertas</small>
              </div>
            </div>
          </div>

          <section className="metrics-row">
            <article><span>Mensagens</span><strong>{audit.messages}</strong><small>fontes detectadas</small></article>
            <article><span>Linhas</span><strong>{audit.lines || '—'}</strong><small>linhas reconhecidas</small></article>
            <article><span>Máquinas</span><strong>{audit.machines}</strong><small>{audit.sourceMachines} vistas no bruto</small></article>
            <article className={audit.review ? 'warning' : 'ok'}><span>Revisão</span><strong>{audit.review}</strong><small>{audit.review ? `${audit.contradictions} conflito(s)` : 'nenhuma pendência'}</small></article>
          </section>

          {audit.issues.length > 0 && (
            <section className="confirmation-panel" aria-label="Conflitos e confirmações">
              <div className="confirmation-panel-head">
                <div>
                  <span className="confirmation-kicker">Antes de enviar</span>
                  <h3>Conflitos e confirmações</h3>
                  <p>O motor não escolhe sozinho quando duas informações incompatíveis aparecem. Confirme com o preparador indicado e depois ajuste o bloco correto no relatório.</p>
                </div>
                <span className="confirmation-count">{audit.issues.length}</span>
              </div>
              <div className="conflict-list">
                {audit.issues.map((issue) => <ConflictCard key={issue.id} issue={issue} snapshot={snapshot} />)}
              </div>
            </section>
          )}

          <section className="panel situation-panel">
            <div className="panel-head">
              <div><span className="step-index">02</span><h3>Situação do setor</h3></div>
              <span className={audit.review ? 'subtle-label' : 'success-label'}>{audit.review ? 'Aguardando confirmações' : 'Consolidado íntegro'}</span>
            </div>
            <div className="situation-grid">
              <div><span>Manutenção parada</span><strong>{snapshot.maintenanceStopped.length}</strong></div>
              <div><span>Setup atual</span><strong>{snapshot.setups.length}</strong></div>
              <div><span>Próximos setups</span><strong>{snapshot.upcomingSetups.length}</strong></div>
              <div><span>Setups {snapshot.nextShift}ºT</span><strong>{snapshot.nextShiftSetups.length}</strong></div>
              <div><span>Ajustes</span><strong>{snapshot.adjustments.length}</strong></div>
              <div><span>Seleções</span><strong>{snapshot.selections.length}</strong></div>
            </div>
          </section>

          <section className="panel counters-panel">
            <div className="panel-head">
              <div><span className="step-index">03</span><h3>Dados manuais do setor</h3></div>
              <span className="subtle-label">Relatório completo</span>
            </div>
            <div className="counters-grid">
              {counterLabels.map(([key, label]) => (
                <Counter key={key} label={label} value={counters[key]} onChange={(value) => setCounters((current) => ({ ...current, [key]: value }))} />
              ))}
            </div>
          </section>

          <section className="panel report-panel">
            <div className="report-toolbar">
              <div><span className="step-index">04</span><h3>Relatórios</h3></div>
              <span className="subtle-label">Edição em blocos</span>
            </div>
            <ReportEditor key={analysisVersion} fullReport={fullReport} compactReport={compactReport} />
          </section>
        </section>
      )}
    </main>
  );
}
