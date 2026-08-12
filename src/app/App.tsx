import { useMemo, useRef, useState } from 'react';
import type {
  AuditIssue,
  ManualCounters,
  OperationalAttention,
  SectorSnapshot,
  Shift,
  SourceMessage,
} from '../domain/types';
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

const counterGroups: Array<{ title: string; items: Array<[keyof ManualCounters, string]> }> = [
  {
    title: 'Qualidade e bancada',
    items: [
      ['checkpoint', 'Check Point'],
      ['cqMachining', 'CQ Usinagem'],
      ['cqClosing', 'CQ Fechamento'],
      ['cqReinspection', 'CQ Reinspeção'],
    ],
  },
  {
    title: 'Ordens para seleção',
    items: [
      ['selectionShift1', 'Seleção 1ºT'],
      ['selectionShift2', 'Seleção 2ºT'],
      ['selectionShift3', 'Seleção 3ºT'],
      ['selectionAll', 'Os 3 turnos'],
      ['selectionTnc', 'Seleção TNC'],
    ],
  },
];

const nextShiftFor = (shift: Shift): Shift => (shift === 3 ? 1 : ((shift + 1) as Shift));

function ShiftButtons({ value, disabledValue, onChange }: { value: Shift; disabledValue?: Shift; onChange: (shift: Shift) => void }) {
  return (
    <div className="shift-buttons">
      {[1, 2, 3].map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabledValue === item}
          className={value === item ? 'active' : ''}
          onClick={() => onChange(item as Shift)}
        >{item}º</button>
      ))}
    </div>
  );
}

function CounterRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="counter-row">
      <div>
        <span>{label}</span>
        <strong>{value || 'N/A'}</strong>
      </div>
      <div className="counter-actions">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function sourceContacts(sourceIds: string[], messages: SourceMessage[]) {
  const wanted = new Set(sourceIds);
  return messages
    .filter((message) => wanted.has(message.id))
    .map((message) => ({
      id: message.id,
      sender: message.sender || 'Preparador não identificado',
      line: message.line ? `Linha ${message.line}` : 'Linha não identificada',
      timestamp: message.timestamp,
    }))
    .filter((contact, index, all) => all.findIndex((item) => item.sender === contact.sender && item.line === contact.line) === index);
}

function ConflictCard({ issue, snapshot }: { issue: AuditIssue; snapshot: SectorSnapshot }) {
  const [copied, setCopied] = useState(false);
  const contacts = getConflictContacts(issue, snapshot);
  const question = getConflictQuestion(issue);
  const instruction = getConfirmationInstruction(issue, snapshot);
  const typeLabel = issue.kind === 'contradiction' ? 'Conflito real' : issue.kind === 'missing-machine' ? 'Informação não consolidada' : 'Interpretação pendente';

  const copyQuestion = async () => {
    await navigator.clipboard.writeText(question);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <article className={`attention-card conflict ${issue.severity}`}>
      <div className="attention-card-head">
        <div>
          <span className="attention-type">{typeLabel}</span>
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
        <button type="button" onClick={copyQuestion}>{copied ? 'Copiada ✓' : 'Copiar pergunta'}</button>
      </div>
    </article>
  );
}

function OperationalAttentionCard({ attention, snapshot }: { attention: OperationalAttention; snapshot: SectorSnapshot }) {
  const contacts = sourceContacts(attention.sourceIds, snapshot.messages);
  const label = attention.kind === 'valid-overlap' ? 'Sobreposição operacional' : 'Múltiplos contextos';

  return (
    <article className={`attention-card overlap ${attention.severity}`}>
      <div className="attention-card-head">
        <div>
          <span className="attention-type">{label}</span>
          <strong>{attention.tnl}</strong>
        </div>
        <span className="attention-status">{attention.severity === 'info' ? 'Acompanhar' : 'Observar'}</span>
      </div>
      <p>{attention.message}</p>

      <div className="context-stack">
        {attention.contexts.map((context) => (
          <div className="context-row" key={context.key}>
            <span>{context.label}</span>
            <strong>{context.detail || 'Sem detalhe adicional'}</strong>
          </div>
        ))}
      </div>

      {contacts.length > 0 && (
        <div className="attention-sources compact">
          <span>Informado por</span>
          <div>
            {contacts.map((contact) => (
              <small key={`${contact.id}-${contact.line}`}><strong>{contact.sender}</strong> · {contact.line}</small>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export default function App() {
  const [raw, setRaw] = useState('');
  const [shift, setShift] = useState<Shift>(2);
  const [selectedNextShift, setSelectedNextShift] = useState<Shift>(3);
  const [snapshot, setSnapshot] = useState<SectorSnapshot | null>(null);
  const [counters, setCounters] = useState<ManualCounters>(initialCounters);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [inputExpanded, setInputExpanded] = useState(true);
  const [manualExpanded, setManualExpanded] = useState(false);
  const [analyzedRaw, setAnalyzedRaw] = useState('');
  const resultRef = useRef<HTMLElement | null>(null);

  const audit = useMemo(() => (snapshot ? auditSnapshot(snapshot) : null), [snapshot]);
  const fullReport = useMemo(() => (snapshot ? generateFullReport(snapshot, counters) : ''), [snapshot, counters]);
  const compactReport = useMemo(() => (snapshot ? generateCompactReport(snapshot) : ''), [snapshot]);
  const rawLineCount = raw.trim() ? raw.trim().split('\n').length : 0;
  const inputDirty = Boolean(snapshot && raw !== analyzedRaw);
  const filledCounters = Object.values(counters).filter((value) => value > 0).length;

  const analyzeForRoute = (currentShift: Shift, nextShift: Shift, shouldScroll = true) => {
    if (!raw.trim()) return;
    const parsed = parseSector(raw, currentShift, nextShift);
    setSnapshot(parsed);
    setAnalyzedRaw(raw);
    setInputExpanded(false);
    setAnalysisVersion((version) => version + 1);
    if (shouldScroll) {
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

  const analyze = () => analyzeForRoute(shift, selectedNextShift);

  const selectCurrentShift = (selectedShift: Shift) => {
    let next = selectedNextShift;
    if (selectedShift === next) {
      next = nextShiftFor(selectedShift);
      setSelectedNextShift(next);
    }
    setShift(selectedShift);
    if (raw.trim() && snapshot) analyzeForRoute(selectedShift, next, false);
  };

  const selectNextShift = (selectedShift: Shift) => {
    if (selectedShift === shift) return;
    setSelectedNextShift(selectedShift);
    if (raw.trim() && snapshot) analyzeForRoute(shift, selectedShift, false);
  };

  const clearInput = () => {
    setRaw('');
    setAnalyzedRaw('');
    setSnapshot(null);
    setCounters(initialCounters);
    setInputExpanded(true);
    setManualExpanded(false);
    setAnalysisVersion((version) => version + 1);
  };

  const handleRawChange = (value: string) => {
    setRaw(value);
    if (snapshot) setInputExpanded(true);
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
        <span className="product-chip">V2.5</span>
      </header>

      <section className="command-panel">
        <div className="command-copy">
          <span>PASSAGEM DE TURNO</span>
          <strong>{shift}º → {selectedNextShift}º</strong>
          <small>Defina a rota do relatório antes da análise.</small>
        </div>
        <div className="route-selectors">
          <div className="route-selector">
            <label>Turno atual</label>
            <ShiftButtons value={shift} disabledValue={selectedNextShift} onChange={selectCurrentShift} />
          </div>
          <span className="route-arrow">→</span>
          <div className="route-selector">
            <label>Próximo turno</label>
            <ShiftButtons value={selectedNextShift} disabledValue={shift} onChange={selectNextShift} />
          </div>
        </div>
      </section>

      <section className="panel intake-panel">
        <div className="panel-head compact-head">
          <div><span className="step-index">01</span><div><h3>Entrada dos preparadores</h3><small>{snapshot ? 'Fonte do consolidado atual' : 'Cole as mensagens copiadas do WhatsApp'}</small></div></div>
          <div className="head-actions">
            {raw && <button className="text-action muted-action" type="button" onClick={clearInput}>Limpar</button>}
            {!snapshot && <button className="text-action" type="button" onClick={() => setRaw(demoInput)}>Demonstração</button>}
          </div>
        </div>

        {snapshot && !inputExpanded && audit ? (
          <div className="input-summary">
            <div className="input-summary-stats">
              <span><strong>{audit.messages}</strong> mensagens</span>
              <span><strong>{audit.lines}</strong> linhas</span>
              <span><strong>{audit.sourceMachines}</strong> TNLs</span>
            </div>
            <div className="input-summary-actions">
              <button type="button" className="secondary-button compact-button" onClick={() => setInputExpanded(true)}>Editar entrada</button>
              <button type="button" className="primary-button compact-button" onClick={analyze}>Reanalisar</button>
            </div>
          </div>
        ) : (
          <>
            <textarea
              value={raw}
              onChange={(event) => handleRawChange(event.target.value)}
              placeholder="Cole aqui todas as mensagens copiadas do WhatsApp..."
              aria-label="Mensagens dos preparadores"
            />
            <div className="intake-footer">
              <div className="intake-status">
                <span className={rawLineCount ? 'live-dot active' : 'live-dot'} />
                <span>{inputDirty ? 'Entrada alterada · reanálise necessária' : rawLineCount ? `${rawLineCount} linhas capturadas` : 'Aguardando mensagens'}</span>
              </div>
              <button className="primary-button" type="button" onClick={analyze} disabled={!raw.trim()}>
                {snapshot ? 'Reanalisar' : 'Analisar setor'} <span>→</span>
              </button>
            </div>
          </>
        )}
      </section>

      {snapshot && audit && (
        <section className="analysis-stack" ref={resultRef}>
          <section className={`overview-panel ${audit.review ? 'has-risk' : ''}`}>
            <div className="overview-status">
              <span className={audit.review ? 'overview-icon warning' : 'overview-icon'}>{audit.review ? '!' : '✓'}</span>
              <div>
                <span>Consolidado {snapshot.currentShift}º → {snapshot.nextShift}º</span>
                <strong>{audit.review ? `${audit.review} confirmação(ões) necessária(s)` : 'Motor íntegro'}</strong>
              </div>
            </div>
            <div className="overview-metrics">
              <div><span>TNLs</span><strong>{audit.machines}</strong></div>
              <div><span>Cobertura</span><strong>{audit.confidence}%</strong></div>
              <div className={audit.attentionCount ? 'attention-metric active' : 'attention-metric'}><span>Atenções</span><strong>{audit.attentionCount}</strong></div>
            </div>
          </section>

          {audit.attentionCount > 0 && (
            <section className="attention-panel" aria-label="Atenções e conflitos do setor">
              <div className="attention-panel-head">
                <div>
                  <span className="attention-kicker">LEITURA CRUZADA</span>
                  <h2>Atenções do setor</h2>
                  <p>Conflitos exigem confirmação. Sobreposições mostram máquinas que aparecem em mais de um contexto, mesmo quando a sequência é coerente.</p>
                </div>
                <div className="attention-totals">
                  <span><strong>{audit.issues.length}</strong> confirmar</span>
                  <span><strong>{audit.attentions.length}</strong> acompanhar</span>
                </div>
              </div>
              <div className="attention-list">
                {audit.issues.map((issue) => <ConflictCard key={issue.id} issue={issue} snapshot={snapshot} />)}
                {audit.attentions.map((attention) => <OperationalAttentionCard key={attention.id} attention={attention} snapshot={snapshot} />)}
              </div>
            </section>
          )}

          <section className="panel situation-panel">
            <div className="panel-head compact-head">
              <div><span className="step-index">02</span><div><h3>Situação do setor</h3><small>Leitura rápida do início do turno</small></div></div>
              <span className={audit.review ? 'risk-label' : 'success-label'}>{audit.review ? 'Com pendências' : 'Consolidado'}</span>
            </div>
            <div className="situation-compact-grid">
              <div><span>Manutenção parada</span><strong>{snapshot.maintenanceStopped.length}</strong></div>
              <div><span>Setup atual</span><strong>{snapshot.setups.length}</strong></div>
              <div><span>Próximos setups</span><strong>{snapshot.upcomingSetups.length}</strong></div>
              <div><span>Setups {snapshot.nextShift}ºT</span><strong>{snapshot.nextShiftSetups.length}</strong></div>
              <div><span>Ajustes</span><strong>{snapshot.adjustments.length}</strong></div>
              <div><span>Seleções</span><strong>{snapshot.selections.length}</strong></div>
            </div>
          </section>

          <section className="panel manual-panel">
            <button className="manual-panel-toggle" type="button" onClick={() => setManualExpanded((value) => !value)} aria-expanded={manualExpanded}>
              <div><span className="step-index">03</span><div><h3>Dados manuais do setor</h3><small>{filledCounters ? `${filledCounters} campo(s) preenchido(s)` : 'Todos os campos estão N/A'}</small></div></div>
              <span>{manualExpanded ? 'Recolher ↑' : 'Preencher ↓'}</span>
            </button>
            {manualExpanded && (
              <div className="manual-groups">
                {counterGroups.map((group) => (
                  <div className="manual-group" key={group.title}>
                    <h4>{group.title}</h4>
                    <div className="counter-list">
                      {group.items.map(([key, label]) => (
                        <CounterRow key={key} label={label} value={counters[key]} onChange={(value) => setCounters((current) => ({ ...current, [key]: value }))} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel report-panel">
            <div className="report-toolbar">
              <div><span className="step-index">04</span><div><h3>Relatórios</h3><small>Edite os blocos e copie exatamente como está na tela</small></div></div>
            </div>
            <ReportEditor key={analysisVersion} fullReport={fullReport} compactReport={compactReport} />
          </section>
        </section>
      )}
    </main>
  );
}
