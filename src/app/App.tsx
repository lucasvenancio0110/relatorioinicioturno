import { useMemo, useRef, useState } from 'react';
import type { ManualCounters, SectorSnapshot, Shift } from '../domain/types';
import { auditSnapshot } from '../engine/audit';
import { parseSector } from '../engine/parser';
import { generateCombinedReport, generateCompactReport, generateFullReport } from '../engine/reports';
import { demoInput } from '../features/demo';

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

type ReportMode = 'combined' | 'full' | 'compact';

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

export default function App() {
  const [raw, setRaw] = useState('');
  const [shift, setShift] = useState<Shift>(2);
  const [snapshot, setSnapshot] = useState<SectorSnapshot | null>(null);
  const [counters, setCounters] = useState<ManualCounters>(initialCounters);
  const [reportMode, setReportMode] = useState<ReportMode>('combined');
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLElement | null>(null);

  const audit = useMemo(() => (snapshot ? auditSnapshot(snapshot) : null), [snapshot]);
  const report = useMemo(() => {
    if (!snapshot) return '';
    if (reportMode === 'full') return generateFullReport(snapshot, counters);
    if (reportMode === 'compact') return generateCompactReport(snapshot);
    return generateCombinedReport(snapshot, counters);
  }, [snapshot, counters, reportMode]);

  const rawLineCount = raw.trim() ? raw.trim().split('\n').length : 0;

  const analyze = () => {
    if (!raw.trim()) return;
    setSnapshot(parseSector(raw, shift));
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const clearInput = () => {
    setRaw('');
    setSnapshot(null);
    setCounters(initialCounters);
    setCopied(false);
  };

  const copyReport = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
        <div className="shift-control">
          <span>Turno atual</span>
          <div>
            {[1, 2, 3].map((item) => (
              <button key={item} type="button" className={shift === item ? 'active' : ''} onClick={() => setShift(item as Shift)}>{item}º</button>
            ))}
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
                <small>{audit.review ? `${audit.review} item(ns) precisam de revisão` : 'Consolidado íntegro, sem perda silenciosa'}</small>
              </div>
            </div>
            <div className="confidence-inline">
              <span>Confiança</span>
              <strong>{audit.confidence}%</strong>
              <small>{audit.machines}/{audit.sourceMachines || audit.machines} TNLs cobertas</small>
            </div>
          </div>

          <section className="metrics-row">
            <article><span>Mensagens</span><strong>{audit.messages}</strong><small>fontes detectadas</small></article>
            <article><span>Linhas</span><strong>{audit.lines || '—'}</strong><small>linhas reconhecidas</small></article>
            <article><span>Máquinas</span><strong>{audit.machines}</strong><small>{audit.sourceMachines} vistas no bruto</small></article>
            <article className={audit.review ? 'warning' : 'ok'}><span>Revisão</span><strong>{audit.review}</strong><small>{audit.review ? `${audit.contradictions} contradição(ões)` : 'nenhuma pendência'}</small></article>
          </section>

          <section className="panel situation-panel">
            <div className="panel-head">
              <div><span className="step-index">02</span><h3>Situação do setor</h3></div>
              <span className={audit.review ? 'subtle-label' : 'success-label'}>{audit.review ? 'Revisar exceções' : 'Consolidado íntegro'}</span>
            </div>
            <div className="situation-grid">
              <div><span>Manutenção parada</span><strong>{snapshot.maintenanceStopped.length}</strong></div>
              <div><span>Setup atual</span><strong>{snapshot.setups.length}</strong></div>
              <div><span>Próximos setups</span><strong>{snapshot.upcomingSetups.length}</strong></div>
              <div><span>Setups {snapshot.nextShift}ºT</span><strong>{snapshot.nextShiftSetups.length}</strong></div>
              <div><span>Ajustes</span><strong>{snapshot.adjustments.length}</strong></div>
              <div><span>Seleções</span><strong>{snapshot.selections.length}</strong></div>
            </div>
            {audit.issues.length > 0 && (
              <div className="review-box">
                <strong>Revisão necessária</strong>
                {audit.issues.map((issue) => <p key={issue.id}>{issue.severity === 'critical' ? 'CRÍTICO · ' : ''}{issue.message}</p>)}
              </div>
            )}
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
              <div><span className="step-index">04</span><h3>Relatório pronto</h3></div>
              <div className="segmented" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <button className={reportMode === 'combined' ? 'active' : ''} type="button" onClick={() => setReportMode('combined')}>Ambos</button>
                <button className={reportMode === 'full' ? 'active' : ''} type="button" onClick={() => setReportMode('full')}>Completo</button>
                <button className={reportMode === 'compact' ? 'active' : ''} type="button" onClick={() => setReportMode('compact')}>Resumido</button>
              </div>
            </div>
            <pre>{report}</pre>
            <div className="report-footer">
              <span>{report.split('\n').length} linhas geradas</span>
              <button className="primary-button" type="button" onClick={copyReport}>{copied ? 'Copiado ✓' : 'Copiar para WhatsApp'}</button>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
