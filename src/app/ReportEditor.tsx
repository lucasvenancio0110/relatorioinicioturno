import { useEffect, useMemo, useState } from 'react';
import { Tabs } from 'radix-ui';
import { ArrowDown, ArrowUp, Check, Copy, PencilLine, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { REPORT_SEPARATOR } from '../engine/reports';
import {
  createReportBlock,
  createReportLine,
  getSharedReportBlockKey,
  parseReportDocument,
  removeSharedReportBlock,
  serializeReportDocument,
  syncSharedReportBlock,
  type ReportDocumentBlock,
} from '../engine/reportDocument';
import { readReportWorkspace, saveReportWorkspace } from '../storage/workspaceStorage';

type ReportTab = 'full' | 'compact';

interface ReportEditorProps {
  fullReport: string;
  compactReport: string;
  persistenceRevision: number;
}

interface BlockCardProps {
  block: ReportDocumentBlock;
  index: number;
  total: number;
  editing: boolean;
  editMode: boolean;
  linked: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (block: ReportDocumentBlock) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}

export function reportBlockHeadingCount(block: ReportDocumentBlock): number {
  let count = 0;
  for (const line of block.lines) {
    if (!line.bold) break;
    count += 1;
  }
  return count;
}

export function reportBlockBody(block: ReportDocumentBlock): string {
  return block.lines.slice(reportBlockHeadingCount(block)).map((line) => line.text).join('\n');
}

export function replaceReportBlockBody(block: ReportDocumentBlock, body: string): ReportDocumentBlock {
  const headingCount = reportBlockHeadingCount(block);
  const headings = block.lines.slice(0, headingCount);
  const previousBody = block.lines.slice(headingCount);
  const values = body.split('\n');
  const bodyLines = values.map((text, index) => ({
    id: previousBody[index]?.id || createReportLine().id,
    text,
    bold: false,
  }));
  return { ...block, lines: [...headings, ...(bodyLines.length ? bodyLines : [createReportLine('', false)])] };
}

function BlockCard({ block, index, total, editing, editMode, linked, onEdit, onDone, onChange, onDelete, onMove }: BlockCardProps) {
  const [draft, setDraft] = useState(() => reportBlockBody(block));
  const headingCount = reportBlockHeadingCount(block);
  const headingLines = block.lines.slice(0, headingCount);
  const values = block.lines.slice(headingCount).map((line) => line.text.trim().toUpperCase()).filter(Boolean);
  const empty = !editing && values.length > 0 && values.every((value) => value === 'N/A');

  useEffect(() => {
    if (editing) setDraft(reportBlockBody(block));
  }, [editing, block.id]);

  if (!editing) {
    return (
      <article className={`report-preview-block editable-report-block${empty ? ' empty-report-block' : ''}${editMode ? ' edit-mode-visible' : ''}`}>
        {editMode && <button className="block-edit-trigger" type="button" onClick={onEdit} aria-label={`Editar bloco ${index + 1}`}><PencilLine size={15}/></button>}
        {block.lines.map((line) => (
          <div className={line.bold ? 'report-preview-line heading' : 'report-preview-line'} key={line.id}>
            {line.text || '\u00A0'}
          </div>
        ))}
      </article>
    );
  }

  const save = () => {
    onChange(replaceReportBlockBody(block, draft));
    onDone();
  };

  return (
    <article className="report-preview-block report-block-editing block-editor-v5">
      <div className="block-editor-v5-head">
        <div>
          <span>EDITANDO</span>
          <strong>{headingLines.map((line) => line.text).join(' · ') || `Bloco ${index + 1}`}</strong>
          {linked && <small>Sincronizado com a outra versão</small>}
        </div>
        <button type="button" className="block-close-v5" onClick={onDone} aria-label="Cancelar edição"><X size={17}/></button>
      </div>

      <label className="whole-block-field">
        <span>Conteúdo</span>
        <textarea
          autoFocus
          value={draft}
          rows={Math.max(4, Math.min(12, draft.split('\n').length + 2))}
          placeholder="Digite ou cole o conteúdo deste bloco."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              save();
            }
            if (event.key === 'Escape') onDone();
          }}
          aria-label={`Conteúdo do bloco ${index + 1}`}
        />
        <small>Ctrl/⌘ + Enter salva · Esc cancela</small>
      </label>

      <div className="block-editor-v5-actions">
        <div className="block-order-actions">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Mover bloco para cima"><ArrowUp size={15}/></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Mover bloco para baixo"><ArrowDown size={15}/></button>
          <button type="button" className="danger-mini" onClick={onDelete}><Trash2 size={15}/> Excluir</button>
        </div>
        <button type="button" className="done-mini primary-save-v5" onClick={save}><Check size={16}/> Salvar</button>
      </div>
    </article>
  );
}

export default function ReportEditor({ fullReport, compactReport, persistenceRevision }: ReportEditorProps) {
  const [restored] = useState(() => readReportWorkspace(persistenceRevision, fullReport, compactReport));
  const [tab, setTab] = useState<ReportTab>(() => restored?.tab ?? 'full');
  const [fullBlocks, setFullBlocks] = useState<ReportDocumentBlock[]>(() => restored?.fullBlocks ?? parseReportDocument(fullReport));
  const [compactBlocks, setCompactBlocks] = useState<ReportDocumentBlock[]>(() => restored?.compactBlocks ?? parseReportDocument(compactReport));
  const [fullDirty, setFullDirty] = useState(() => restored?.fullDirty ?? false);
  const [compactDirty, setCompactDirty] = useState(() => restored?.compactDirty ?? false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingSharedKey, setEditingSharedKey] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [copied, setCopied] = useState<'active' | 'both' | null>(null);

  useEffect(() => {
    if (!fullDirty) setFullBlocks(parseReportDocument(fullReport));
  }, [fullReport, fullDirty]);

  useEffect(() => {
    if (!compactDirty) setCompactBlocks(parseReportDocument(compactReport));
  }, [compactReport, compactDirty]);

  useEffect(() => {
    saveReportWorkspace({ revision: persistenceRevision, sourceFullReport: fullReport, sourceCompactReport: compactReport, tab, fullBlocks, compactBlocks, fullDirty, compactDirty });
  }, [persistenceRevision, fullReport, compactReport, tab, fullBlocks, compactBlocks, fullDirty, compactDirty]);

  const activeBlocks = tab === 'full' ? fullBlocks : compactBlocks;
  const activeDirty = tab === 'full' ? fullDirty : compactDirty;
  const activeLabel = tab === 'full' ? 'Completo' : 'Resumido';
  const activeGenerated = tab === 'full' ? fullReport : compactReport;
  const activeDraft = useMemo(() => serializeReportDocument(activeBlocks), [activeBlocks]);

  const markFull = (next: ReportDocumentBlock[]) => { setFullBlocks(next); setFullDirty(serializeReportDocument(next) !== fullReport); };
  const markCompact = (next: ReportDocumentBlock[]) => { setCompactBlocks(next); setCompactDirty(serializeReportDocument(next) !== compactReport); };
  const replaceActiveOnly = (next: ReportDocumentBlock[]) => { if (tab === 'full') markFull(next); else markCompact(next); };

  const restoreActive = () => {
    const restoredDocument = parseReportDocument(activeGenerated);
    if (tab === 'full') { setFullBlocks(restoredDocument); setFullDirty(false); }
    else { setCompactBlocks(restoredDocument); setCompactDirty(false); }
    setEditingBlockId(null);
    setEditingSharedKey(null);
    setEditMode(false);
  };

  const beginEdit = (block: ReportDocumentBlock) => { setEditMode(true); setEditingBlockId(block.id); setEditingSharedKey(getSharedReportBlockKey(block)); };
  const finishEdit = () => { setEditingBlockId(null); setEditingSharedKey(null); };

  const changeBlock = (blockId: string, nextBlock: ReportDocumentBlock) => {
    const sharedKey = editingBlockId === blockId ? editingSharedKey : getSharedReportBlockKey(activeBlocks.find((block) => block.id === blockId) || nextBlock);
    const nextActive = activeBlocks.map((block) => block.id === blockId ? nextBlock : block);
    if (tab === 'full') { markFull(nextActive); if (sharedKey) markCompact(syncSharedReportBlock(compactBlocks, sharedKey, nextBlock)); }
    else { markCompact(nextActive); if (sharedKey) markFull(syncSharedReportBlock(fullBlocks, sharedKey, nextBlock)); }
  };

  const deleteBlock = (blockId: string) => {
    const currentBlock = activeBlocks.find((block) => block.id === blockId);
    const sharedKey = editingBlockId === blockId ? editingSharedKey : currentBlock ? getSharedReportBlockKey(currentBlock) : null;
    const nextActive = activeBlocks.filter((block) => block.id !== blockId);
    if (tab === 'full') { markFull(nextActive); if (sharedKey) markCompact(removeSharedReportBlock(compactBlocks, sharedKey)); }
    else { markCompact(nextActive); if (sharedKey) markFull(removeSharedReportBlock(fullBlocks, sharedKey)); }
    finishEdit();
  };

  const moveBlock = (blockId: string, direction: -1 | 1) => {
    const index = activeBlocks.findIndex((block) => block.id === blockId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeBlocks.length) return;
    const next = [...activeBlocks];
    [next[index], next[target]] = [next[target], next[index]];
    replaceActiveOnly(next);
  };

  const addBlock = () => {
    const block = createReportBlock();
    replaceActiveOnly([...activeBlocks, block]);
    setEditMode(true);
    setEditingBlockId(block.id);
    setEditingSharedKey(null);
    window.setTimeout(() => document.getElementById(`report-block-${block.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  const copyText = async (kind: 'active' | 'both') => {
    const fullDraft = serializeReportDocument(fullBlocks);
    const compactDraft = serializeReportDocument(compactBlocks);
    const text = kind === 'both' ? `${fullDraft}\n\n${REPORT_SEPARATOR}\n\n${compactDraft}` : activeDraft;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const selectTab = (nextTab: string) => { setTab(nextTab as ReportTab); finishEdit(); setEditMode(false); };
  const toggleEditMode = () => { finishEdit(); setEditMode((current) => !current); };

  return (
    <div className="report-workspace v5-report-workspace v8-report-workspace">
      <div className="v8-report-topline">
        <Tabs.Root className="report-tabs-root" value={tab} onValueChange={selectTab}>
          <Tabs.List className="report-tabs" aria-label="Versão do relatório">
            <Tabs.Trigger value="full">Completo</Tabs.Trigger>
            <Tabs.Trigger value="compact">Resumido</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>

        <div className="v8-report-actions">
          {activeDirty && <span className="edited-badge">Editado</span>}
          {activeDirty && <button type="button" className="ghost-button v8-restore-button" onClick={restoreActive}><RotateCcw size={14}/> Restaurar</button>}
          <button type="button" className={`v8-edit-mode-button${editMode ? ' active' : ''}`} onClick={toggleEditMode}>{editMode ? <><Check size={15}/> Concluir</> : <><PencilLine size={15}/> Editar</>}</button>
        </div>
      </div>

      <div className={`report-preview structured-report${editMode ? ' report-edit-mode' : ''}`} aria-label={`Relatório ${activeLabel.toLowerCase()} editável por blocos`}>
        {activeBlocks.map((block, index) => (
          <div id={`report-block-${block.id}`} key={block.id}>
            <BlockCard block={block} index={index} total={activeBlocks.length} editing={editingBlockId === block.id} editMode={editMode} linked={Boolean(getSharedReportBlockKey(block) || (editingBlockId === block.id && editingSharedKey))} onEdit={() => beginEdit(block)} onDone={finishEdit} onChange={(nextBlock) => changeBlock(block.id, nextBlock)} onDelete={() => deleteBlock(block.id)} onMove={(direction) => moveBlock(block.id, direction)}/>
          </div>
        ))}
        {editMode && <button className="add-block-button" type="button" onClick={addBlock}><Plus size={15}/> Adicionar bloco</button>}
      </div>

      {editMode && <div className="report-meta-row"><span>{activeDraft.split('\n').length} linhas</span><span>{activeDraft.length.toLocaleString('pt-BR')} caracteres</span></div>}
      <div className="report-copy-actions">
        <button className="primary-button" type="button" onClick={() => copyText('active')}><Copy size={16}/>{copied === 'active' ? 'Copiado ✓' : `Copiar ${activeLabel.toLowerCase()}`}</button>
        <button className="secondary-button" type="button" onClick={() => copyText('both')}><Copy size={16}/>{copied === 'both' ? 'Os dois copiados ✓' : 'Copiar os dois'}</button>
      </div>
    </div>
  );
}
