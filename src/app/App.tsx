import { useMemo, useState } from 'react';
import type { ManualCounters, SectorSnapshot, Shift } from '../domain/types';
import { auditSnapshot } from '../engine/audit';
import { parseSector } from '../engine/parser';
import { generateCompactReport, generateFullReport } from '../engine/reports';
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

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="counter-card">
      <div><span className="counter-label">{label}</span><strong>{value || 'N/A'}</strong></div>
      <div className="counter-actions">
        <button onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <button onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

export default function App() {
  const [raw, setRaw] = useState('');
  const [shift, setShift] = useState<Shift>(2);
  const [snapshot, setSnapshot] = useState<SectorSnapshot | null>(null);
  const [counters, setCounters] = useState<ManualCounters>(initialCounters);
  const [reportMode, setReportMode] = useState<'full' | 'compact'>('full');
  const [copied, setCopied] = useState(false);

  const audit = useMemo(() => (snapshot ? auditSnapshot(snapshot) : null), [snapshot]);
  const report = useMemo(() => !snapshot ? '' : reportMode === 'full' ? generateFullReport(snapshot, counters) : generateCompactReport(snapshot), [snapshot, counters, reportMode]);

  const analyze = () => raw.trim() && setSnapshot(parseSector(raw, shift));
  const copyReport = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">MOTOR OPERACIONAL V2</span><h1>Relatório de turno</h1></div>
        <div className="status-chip"><span /> Local · seguro</div>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-kicker">Consolidado inteligente</span>
          <h2>Cole o caos.<br />Receba a situação do setor.</h2>
          <p>O motor identifica mensagens, máquinas, eventos, turnos e inconsistências antes de gerar os dois relatórios.</p>
        </div>
        <div className="shift-control">
          <span>Turno atual</span>
          <div>{[1, 2, 3].map((item) => <button key={item} className={shift === item ? 'active' : ''} onClick={() => setShift(item as Shift)}>{item}º</button>)}</div>
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel intake-panel">
          <div className="panel-head"><div><span className="step-index">01</span><h3>Entrada dos preparadores</h3></div><button className="text-action" onClick={() => setRaw(demoInput)}>Usar demonstração</button></div>
          <textarea value={raw} onChange={(event) => setRaw(event.target.value)} placeholder="Cole aqui todas as mensagens copiadas do WhatsApp..." />
          <div className="intake-footer"><span>{raw.trim() ? `${raw.split('\n').length} linhas capturadas` : 'Aguardando mensagens'}</span><button className="primary-button" onClick={analyze} disabled={!raw.trim()}>Analisar setor <span>→</span></button></div>
        </div>

        <aside className="panel engine-panel">
          <div className="panel-head"><div><span className="step-index">02</span><h3>Motor V2</h3></div></div>
          <div className="engine-flow">{['Separar mensagens', 'Normalizar texto', 'Extrair entidades', 'Classificar eventos', 'Auditar saída'].map((label, index) => <div className={snapshot ? 'done' : ''} key={label}><span>{snapshot ? '✓' : String(index + 1).padStart(2, '0')}</span><strong>{label}</strong></div>)}</div>
          <div className="confidence-card"><span>Confiança operacional</span><strong>{audit ? `${audit.confidence}%` : '—'}</strong><div><i style={{ width: `${audit?.confidence ?? 0}%` }} /></div></div>
        </aside>
      </section>

      {snapshot && audit && <>
        <section className="metrics-row">
          <article><span>Mensagens</span><strong>{audit.messages}</strong><small>fontes detectadas</small></article>
          <article><span>Linhas</span><strong>{audit.lines || '—'}</strong><small>linhas reconhecidas</small></article>
          <article><span>Máquinas</span><strong>{audit.machines}</strong><small>TNLs consolidadas</small></article>
          <article className={audit.review ? 'warning' : 'ok'}><span>Revisão</span><strong>{audit.review}</strong><small>{audit.review ? 'itens para conferir' : 'nenhuma pendência'}</small></article>
        </section>

        <section className="panel situation-panel">
          <div className="panel-head"><div><span className="step-index">03</span><h3>Situação do setor</h3></div><span className="success-label">Consolidado</span></div>
          <div className="situation-grid">
            <div><span>Manutenção parada</span><strong>{snapshot.maintenanceStopped.length}</strong></div>
            <div><span>Setup atual</span><strong>{snapshot.setups.length}</strong></div>
            <div><span>Próximos setups</span><strong>{snapshot.upcomingSetups.length}</strong></div>
            <div><span>Setups {snapshot.nextShift}ºT</span><strong>{snapshot.nextShiftSetups.length}</strong></div>
            <div><span>Ajustes</span><strong>{snapshot.adjustments.length}</strong></div>
            <div><span>Seleções</span><strong>{snapshot.selections.length}</strong></div>
          </div>
          {snapshot.review.length > 0 && <div className="review-box"><strong>Revisão necessária</strong>{snapshot.review.map((item) => <p key={item}>{item}</p>)}</div>}
        </section>

        <section className="panel counters-panel">
          <div className="panel-head"><div><span className="step-index">04</span><h3>Dados manuais do setor</h3></div><span className="subtle-label">Entram no relatório completo</span></div>
          <div className="counters-grid">{counterLabels.map(([key, label]) => <Counter key={key} label={label} value={counters[key]} onChange={(value) => setCounters((current) => ({ ...current, [key]: value }))} />)}</div>
        </section>

        <section className="panel report-panel">
          <div className="report-toolbar"><div><span className="step-index">05</span><h3>Relatório pronto</h3></div><div className="segmented"><button className={reportMode === 'full' ? 'active' : ''} onClick={() => setReportMode('full')}>Completo</button><button className={reportMode === 'compact' ? 'active' : ''} onClick={() => setReportMode('compact')}>Resumido</button></div></div>
          <pre>{report}</pre>
          <div className="report-footer"><span>{report.split('\n').length} linhas geradas</span><button className="primary-button" onClick={copyReport}>{copied ? 'Copiado ✓' : 'Copiar para WhatsApp'}</button></div>
        </section>
      </>}
    </main>
  );
}
