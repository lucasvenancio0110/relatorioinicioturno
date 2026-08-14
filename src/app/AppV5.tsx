import { useEffect, useMemo, useRef, useState } from 'react';
import { Collapsible } from 'radix-ui';
import { MotionConfig } from 'motion/react';
import { Activity, ArrowRight, ChevronDown, ChevronUp, CircleGauge, FileText, ListChecks, PencilLine, RefreshCw, Save, Settings2, SlidersHorizontal, Trash2, Wrench } from 'lucide-react';
import type { AssistedValidation, ManualCounters, OperationalAttention, SectorSnapshot, Shift } from '../domain/types';
import { applyAssistedValidation, buildAssistedValidations, type AssistedValidationDecision } from '../engine/assistedValidation';
import { applyAttentionDecision, type AttentionDecision } from '../engine/attentionResolution';
import { auditSnapshot } from '../engine/audit';
import { parseSector } from '../engine/parser';
import { generateCompactReport, generateFullReport } from '../engine/reports';
import { demoInput } from '../features/demo';
import { clearReportWorkspace, clearWorkspace, readWorkspace, saveWorkspace } from '../storage/workspaceStorage';
import ReportEditor from './ReportEditor';
import ValidationHub from './ValidationHub';

const initialCounters: ManualCounters = { checkpoint: 0, cqMachining: 0, cqClosing: 0, cqReinspection: 0, selectionShift1: 0, selectionShift2: 0, selectionShift3: 0, selectionAll: 0, selectionTnc: 0 };
const counterGroups: Array<{ title: string; items: Array<[keyof ManualCounters, string]> }> = [
  { title: 'Qualidade e bancada', items: [['checkpoint', 'Check Point'], ['cqClosing', 'CQ Fechamento'], ['cqReinspection', 'CQ Reinspeção']] },
  { title: 'Ordens para seleção', items: [['selectionShift1', 'Seleção 1ºT'], ['selectionShift2', 'Seleção 2ºT'], ['selectionShift3', 'Seleção 3ºT'], ['selectionAll', 'Os 3 turnos'], ['selectionTnc', 'Seleção TNC']] },
];
const visibleCounterKeys = counterGroups.flatMap((group) => group.items.map(([key]) => key));
const nextShiftFor = (shift: Shift): Shift => (shift === 3 ? 1 : ((shift + 1) as Shift));
const restoredWorkspace = readWorkspace();
const desktopDefault = typeof window !== 'undefined' && window.matchMedia('(min-width: 980px)').matches;

function ShiftButtons({ value, disabledValue, onChange }: { value: Shift; disabledValue?: Shift; onChange: (shift: Shift) => void }) {
  return <div className="shift-buttons">{[1, 2, 3].map((item) => <button key={item} type="button" disabled={disabledValue === item} className={value === item ? 'active' : ''} onClick={() => onChange(item as Shift)}>{item}º</button>)}</div>;
}

function CounterRow({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className={`counter-row v5-counter-row${value > 0 ? ' has-value' : ''}`}><label><span>{label}</span><input type="number" min="0" inputMode="numeric" value={value || ''} placeholder="N/A" aria-label={label} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}/></label><div className="counter-actions">{value > 0 && <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onChange(Math.max(0, value - 1))}>−</button>}<button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(value + 1)}>+</button></div></div>;
}

export default function AppV5() {
  const [raw, setRaw] = useState(() => restoredWorkspace?.raw ?? '');
  const [shift, setShift] = useState<Shift>(() => restoredWorkspace?.shift ?? 2);
  const [selectedNextShift, setSelectedNextShift] = useState<Shift>(() => restoredWorkspace?.selectedNextShift ?? 3);
  const [snapshot, setSnapshot] = useState<SectorSnapshot | null>(() => restoredWorkspace?.snapshot ?? null);
  const [counters, setCounters] = useState<ManualCounters>(() => restoredWorkspace?.counters ?? initialCounters);
  const [analysisVersion, setAnalysisVersion] = useState(() => restoredWorkspace?.analysisVersion ?? 0);
  const [inputExpanded, setInputExpanded] = useState(() => !restoredWorkspace?.snapshot);
  const [manualExpanded, setManualExpanded] = useState(true);
  const [reportExpanded, setReportExpanded] = useState(() => desktopDefault || Boolean(restoredWorkspace?.snapshot));
  const [analyzedRaw, setAnalyzedRaw] = useState(() => restoredWorkspace?.analyzedRaw ?? '');
  const [validatedAttentionIds, setValidatedAttentionIds] = useState<Set<string>>(() => new Set(restoredWorkspace?.validatedAttentionIds ?? []));
  const [validatedInterpretationIds, setValidatedInterpretationIds] = useState<Set<string>>(() => new Set(restoredWorkspace?.validatedInterpretationIds ?? []));
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => restoredWorkspace?.savedAt ?? null);
  const resultRef = useRef<HTMLElement | null>(null);
  const validationRef = useRef<HTMLDivElement | null>(null);
  const situationRef = useRef<HTMLElement | null>(null);
  const manualRef = useRef<HTMLElement | null>(null);
  const reportRef = useRef<HTMLElement | null>(null);

  const audit = useMemo(() => snapshot ? auditSnapshot(snapshot) : null, [snapshot]);
  const assistedValidations = useMemo(() => snapshot ? buildAssistedValidations(snapshot) : [], [snapshot]);
  const unresolvedValidations = assistedValidations.filter((item) => !validatedInterpretationIds.has(item.id));
  const fullReport = useMemo(() => snapshot ? generateFullReport(snapshot, counters) : '', [snapshot, counters]);
  const compactReport = useMemo(() => snapshot ? generateCompactReport(snapshot) : '', [snapshot]);
  const rawLineCount = raw.trim() ? raw.trim().split('\n').length : 0;
  const inputDirty = Boolean(snapshot && raw !== analyzedRaw);
  const filledCounters = visibleCounterKeys.filter((key) => counters[key] > 0).length;
  const unresolvedAttentions = audit?.attentions.filter((attention) => !validatedAttentionIds.has(attention.id)) || [];
  const resolvedAttentions = audit?.attentions.filter((attention) => validatedAttentionIds.has(attention.id)) || [];
  const pendingAttentionCount = (audit?.issues.length || 0) + unresolvedAttentions.length + unresolvedValidations.length;
  const hasValidationRisk = Boolean((audit?.review || 0) + unresolvedValidations.length);

  useEffect(() => {
    const persist = () => saveWorkspace({ raw, analyzedRaw, shift, selectedNextShift, snapshot, counters, validatedAttentionIds: [...validatedAttentionIds], validatedInterpretationIds: [...validatedInterpretationIds], analysisVersion });
    const timer = window.setTimeout(() => { const savedAt = persist(); if (savedAt) setLastSavedAt(savedAt); }, 120);
    const persistImmediately = () => { const savedAt = persist(); if (savedAt) setLastSavedAt(savedAt); };
    window.addEventListener('pagehide', persistImmediately);
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', persistImmediately); };
  }, [raw, analyzedRaw, shift, selectedNextShift, snapshot, counters, validatedAttentionIds, validatedInterpretationIds, analysisVersion]);

  const analyzeForRoute = (currentShift: Shift, nextShift: Shift, shouldScroll = true) => {
    if (!raw.trim()) return;
    setSnapshot(parseSector(raw, currentShift, nextShift));
    setValidatedAttentionIds(new Set());
    setValidatedInterpretationIds(new Set());
    setAnalyzedRaw(raw);
    setInputExpanded(false);
    setReportExpanded(desktopDefault);
    setAnalysisVersion((version) => version + 1);
    if (shouldScroll) window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const analyze = () => analyzeForRoute(shift, selectedNextShift);
  const selectCurrentShift = (selectedShift: Shift) => { let next = selectedNextShift; if (selectedShift === next) { next = nextShiftFor(selectedShift); setSelectedNextShift(next); } setShift(selectedShift); if (raw.trim() && snapshot) analyzeForRoute(selectedShift, next, false); };
  const selectNextShift = (selectedShift: Shift) => { if (selectedShift === shift) return; setSelectedNextShift(selectedShift); if (raw.trim() && snapshot) analyzeForRoute(shift, selectedShift, false); };
  const clearInput = () => { clearWorkspace(); clearReportWorkspace(); setRaw(''); setAnalyzedRaw(''); setSnapshot(null); setValidatedAttentionIds(new Set()); setValidatedInterpretationIds(new Set()); setInputExpanded(true); setReportExpanded(false); setLastSavedAt(null); setAnalysisVersion((version) => version + 1); };
  const clearManual = () => setCounters(initialCounters);
  const validateAttention = (id: string) => setValidatedAttentionIds((current) => new Set(current).add(id));
  const reopenAttention = (id: string) => setValidatedAttentionIds((current) => { const next = new Set(current); next.delete(id); return next; });
  const resolveInterpretation = (id: string) => setValidatedInterpretationIds((current) => new Set(current).add(id));
  const applyOperationalAttentionDecision = (attention: OperationalAttention, decision: AttentionDecision) => { setSnapshot((current) => current ? applyAttentionDecision(current, attention, decision) : current); if (decision.selectedContextKeys.length > 1) validateAttention(attention.id); else reopenAttention(attention.id); };
  const applyInterpretationDecision = (validation: AssistedValidation, decision: AssistedValidationDecision) => setSnapshot((current) => current ? applyAssistedValidation(current, validation, decision) : current);
  const showValidationPanel = Boolean(unresolvedValidations.length || audit?.issues.length || unresolvedAttentions.length || resolvedAttentions.length);
  const scrollTo = (target: HTMLElement | null) => target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const openManual = () => { setManualExpanded(true); window.setTimeout(() => scrollTo(manualRef.current), 40); };
  const openReport = () => { setReportExpanded(true); window.setTimeout(() => scrollTo(reportRef.current), 40); };

  return <MotionConfig reducedMotion="user"><main className="app-shell v4-shell v5-shell v8-shell">
    <header className="topbar v4-topbar v5-topbar v8-topbar"><div className="brand-lockup"><div className="brand-mark">R</div><div><span className="eyebrow">RELATÓRIO INICIAL</span><h1>Início de turno</h1></div></div>{lastSavedAt && <span className="product-chip v4-save-chip"><Save size={14}/> Salvo</span>}</header>

    <section className="command-panel v4-route-card v5-route-card v8-route-card"><div className="command-copy"><span>PASSAGEM</span><strong>{shift}º <ArrowRight size={18}/> {selectedNextShift}º</strong><small>{lastSavedAt ? 'Rascunho local protegido' : 'Defina a rota do relatório'}</small></div><div className="route-selectors"><div className="route-selector"><label>Atual</label><ShiftButtons value={shift} disabledValue={selectedNextShift} onChange={selectCurrentShift}/></div><span className="route-arrow"><ArrowRight size={18}/></span><div className="route-selector"><label>Próximo</label><ShiftButtons value={selectedNextShift} disabledValue={shift} onChange={selectNextShift}/></div></div></section>

    <div className="v5-intake-grid v8-intake-grid">
      <Collapsible.Root open={manualExpanded} onOpenChange={setManualExpanded} asChild>
        <section className="panel manual-panel v4-manual v5-manual v8-manual" ref={manualRef}>
          <Collapsible.Trigger asChild><button className="manual-panel-toggle" type="button"><div><span className="step-index">01</span><div><h3>Dados manuais do setor</h3></div></div><span className="v8-collapse-affordance">{filledCounters > 0 && <b className="v8-section-count">{filledCounters}</b>}{manualExpanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</span></button></Collapsible.Trigger>
          <Collapsible.Content><div className="manual-groups v5-manual-groups">{counterGroups.map((group) => <div className="manual-group" key={group.title}><h4>{group.title}</h4><div className="counter-list">{group.items.map(([key, label]) => <CounterRow key={key} label={label} value={counters[key]} onChange={(value) => setCounters((current) => ({ ...current, [key]: value }))}/>)}</div></div>)}<button type="button" className="v5-clear-manual v8-clear-manual" onClick={clearManual}><Trash2 size={13}/> Limpar</button></div></Collapsible.Content>
        </section>
      </Collapsible.Root>

      <section className="panel intake-panel v4-intake v5-intake v8-intake"><div className="panel-head compact-head"><div><span className="step-index">02</span><div><h3>Mensagens dos preparadores</h3></div></div><div className="head-actions">{raw && <button className="icon-text-action muted-action" type="button" onClick={clearInput} aria-label="Limpar entrada"><Trash2 size={16}/></button>}{!snapshot && <button className="text-action" type="button" onClick={() => setRaw(demoInput)}>Demonstração</button>}</div></div>
        {snapshot && !inputExpanded && audit ? <div className="input-summary v4-input-summary"><div className="input-summary-stats"><span><strong>{audit.messages}</strong><small>mensagens</small></span><span><strong>{audit.lines}</strong><small>linhas</small></span><span><strong>{audit.sourceMachines}</strong><small>TNLs</small></span></div><div className="input-summary-actions"><button type="button" className="secondary-button compact-button" onClick={() => setInputExpanded(true)}><PencilLine size={15}/> Editar</button><button type="button" className="primary-button compact-button" onClick={analyze}><RefreshCw size={15}/> Reanalisar</button></div></div> : <><textarea className="v5-raw-input" value={raw} onChange={(event) => { setRaw(event.target.value); if (snapshot) setInputExpanded(true); }} placeholder="Cole aqui as mensagens do WhatsApp..." aria-label="Mensagens dos preparadores"/><div className="intake-footer"><div className="intake-status"><span className={rawLineCount ? 'live-dot active' : 'live-dot'}/><span>{inputDirty ? 'Alterado · reanalise para atualizar' : rawLineCount ? `${rawLineCount} linhas` : 'Aguardando mensagens'}</span></div><button className="primary-button" type="button" onClick={analyze} disabled={!raw.trim()}>{snapshot ? 'Reanalisar' : 'Analisar'} <ArrowRight size={16}/></button></div></>}
      </section>
    </div>

    {snapshot && audit && <section className="analysis-stack v4-analysis v5-analysis v8-analysis" ref={resultRef}>
      <section className={`overview-panel v4-overview v8-statusbar ${hasValidationRisk ? 'has-risk' : ''}`}><div className="v8-status-copy"><span className={hasValidationRisk ? 'overview-icon warning' : 'overview-icon'}>{hasValidationRisk ? '!' : '✓'}</span><strong>{pendingAttentionCount ? `${pendingAttentionCount} para revisar` : 'Pronto para revisar'}</strong></div><div className="v8-status-meta"><span>{audit.machines} TNLs</span><span>{audit.confidence}% cobertura</span></div></section>

      <nav className="workspace-nav v5-workspace-nav v8-workspace-nav" aria-label="Navegação do relatório">{showValidationPanel && <button type="button" onClick={() => scrollTo(validationRef.current)}><Activity size={16}/><span>Validar</span>{pendingAttentionCount > 0 && <b>{pendingAttentionCount}</b>}</button>}<button type="button" onClick={() => scrollTo(situationRef.current)}><CircleGauge size={16}/><span>Situação</span></button><button type="button" onClick={openManual}><SlidersHorizontal size={16}/><span>Dados</span></button><button type="button" onClick={openReport}><FileText size={16}/><span>Relatório</span></button></nav>

      <div className="v5-workbench v8-workbench">
        <div className="v5-workbench-left">
          {showValidationPanel && <div ref={validationRef} className="section-anchor"><ValidationHub snapshot={snapshot} validations={unresolvedValidations} issues={audit.issues} attentions={unresolvedAttentions} resolvedCount={resolvedAttentions.length + (assistedValidations.length - unresolvedValidations.length)} onApplyValidation={applyInterpretationDecision} onResolveValidation={resolveInterpretation} onApplyAttention={applyOperationalAttentionDecision} onValidateAttention={validateAttention} onReopenAttention={reopenAttention}/></div>}
          <section className="panel situation-panel v4-situation v5-situation v8-situation" ref={situationRef}><div className="panel-head compact-head"><div><span className="step-index">03</span><div><h3>Situação do setor</h3></div></div></div><div className="situation-compact-grid v4-metric-grid"><div><Wrench size={16}/><span>Manutenção</span><strong>{snapshot.maintenanceStopped.length}</strong></div><div><Settings2 size={16}/><span>Setup atual</span><strong>{snapshot.setups.length}</strong></div><div><RefreshCw size={16}/><span>Próximos</span><strong>{snapshot.upcomingSetups.length}</strong></div><div><ArrowRight size={16}/><span>{snapshot.nextShift}º turno</span><strong>{snapshot.nextShiftSetups.length}</strong></div><div><SlidersHorizontal size={16}/><span>Ajustes</span><strong>{snapshot.adjustments.length}</strong></div><div><ListChecks size={16}/><span>Seleções</span><strong>{snapshot.selections.length}</strong></div></div></section>
        </div>

        <Collapsible.Root open={reportExpanded} onOpenChange={setReportExpanded} asChild>
          <section className="panel report-panel v4-report v5-report v8-report" ref={reportRef}>
            <Collapsible.Trigger asChild><button type="button" className="report-panel-toggle"><div><span className="step-index">04</span><div><h3>Relatório</h3></div></div><span className="v8-collapse-affordance">{reportExpanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}</span></button></Collapsible.Trigger>
            <Collapsible.Content><div className="report-editor-stage open"><ReportEditor key={analysisVersion} fullReport={fullReport} compactReport={compactReport} persistenceRevision={analysisVersion}/></div></Collapsible.Content>
          </section>
        </Collapsible.Root>
      </div>
    </section>}
  </main></MotionConfig>;
}
