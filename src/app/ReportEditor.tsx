import { useEffect, useMemo, useState } from 'react';
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

type ReportTab = 'full' | 'compact';

interface ReportEditorProps {
  fullReport: string;
  compactReport: string;
}

interface BlockCardProps {
  block: ReportDocumentBlock;
  index: number;
  total: number;
  editing: boolean;
  linked: boolean;
  onEdit: () => void;
  onDone: () => void;
  onChange: (block: ReportDocumentBlock) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}

function BlockCard({ block, index, total, editing, linked, onEdit, onDone, onChange, onDelete, onMove }: BlockCardProps) {
  const updateLine = (lineId: string, patch: { text?: string; bold?: boolean }) => {
    onChange({
      ...block,
      lines: block.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line),
    });
  };

  const removeLine = (lineId: string) => {
    const lines = block.lines.filter((line) => line.id !== lineId);
    onChange({ ...block, lines: lines.length ? lines : [createReportLine('', false)] });
  };

  const addLine = () => onChange({ ...block, lines: [...block.lines, createReportLine('', false)] });
  const values = block.lines.slice(1).map((line) => line.text.trim().toUpperCase()).filter(Boolean);
  const empty = !editing && values.length > 0 && values.every((value) => value === 'N/A');

  if (!editing) {
    return (
      <article className={`report-preview-block editable-report-block${empty ? ' empty-report-block' : ''}`}>
        <button className="block-edit-trigger" type="button" onClick={onEdit} aria-label={`Editar bloco ${index + 1}`}>✎</button>
        {block.lines.map((line) => (
          <div className={line.bold ? 'report-preview-line heading' : 'report-preview-line'} key={line.id}>
            {line.text || '\u00A0'}
          </div>
        ))}
      </article>
    );
  }

  return (
    <article className="report-preview-block report-block-editing">
      <div className="block-edit-toolbar">
        <div>
          <strong>Editar bloco {index + 1}</strong>
          {linked && <small>Sincronizado com a outra versão.</small>}
        </div>
        <div>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Mover bloco para cima">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Mover bloco para baixo">↓</button>
          <button type="button" className="danger-mini" onClick={onDelete}>Excluir</button>
          <button type="button" className="done-mini" onClick={onDone}>Concluir</button>
        </div>
      </div>

      <div className="block-line-editor-list">
        {block.lines.map((line, lineIndex) => (
          <div className="block-line-editor" key={line.id}>
            <button
              type="button"
              className={line.bold ? 'format-toggle active' : 'format-toggle'}
              onClick={() => updateLine(line.id, { bold: !line.bold })}
              aria-label={line.bold ? 'Remover destaque da linha' : 'Transformar linha em título'}
              title="Título/negrito no WhatsApp"
            >B</button>
            <textarea
              rows={1}
              value={line.text}
              onChange={(event) => updateLine(line.id, { text: event.target.value.replace(/\n/g, ' ') })}
              aria-label={`Linha ${lineIndex + 1} do bloco ${index + 1}`}
            />
            <button className="remove-line" type="button" onClick={() => removeLine(line.id)} aria-label="Excluir linha">×</button>
          </div>
        ))}
      </div>

      <button className="add-line-button" type="button" onClick={addLine}>+ Adicionar linha</button>
    </article>
  );
}

export default function ReportEditor({ fullReport, compactReport }: ReportEditorProps) {
  const [tab, setTab] = useState<ReportTab>('full');
  const [fullBlocks, setFullBlocks] = useState<ReportDocumentBlock[]>(() => parseReportDocument(fullReport));
  const [compactBlocks, setCompactBlocks] = useState<ReportDocumentBlock[]>(() => parseReportDocument(compactReport));
  const [fullDirty, setFullDirty] = useState(false);
  const [compactDirty, setCompactDirty] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingSharedKey, setEditingSharedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<'active' | 'both' | null>(null);

  useEffect(() => {
    if (!fullDirty) setFullBlocks(parseReportDocument(fullReport));
  }, [fullReport, fullDirty]);

  useEffect(() => {
    if (!compactDirty) setCompactBlocks(parseReportDocument(compactReport));
  }, [compactReport, compactDirty]);

  const activeBlocks = tab === 'full' ? fullBlocks : compactBlocks;
  const activeDirty = tab === 'full' ? fullDirty : compactDirty;
  const activeLabel = tab === 'full' ? 'Completo' : 'Resumido';
  const activeGenerated = tab === 'full' ? fullReport : compactReport;
  const activeDraft = useMemo(() => serializeReportDocument(activeBlocks), [activeBlocks]);

  const markFull = (next: ReportDocumentBlock[]) => {
    setFullBlocks(next);
    setFullDirty(serializeReportDocument(next) !== fullReport);
  };

  const markCompact = (next: ReportDocumentBlock[]) => {
    setCompactBlocks(next);
    setCompactDirty(serializeReportDocument(next) !== compactReport);
  };

  const replaceActiveOnly = (next: ReportDocumentBlock[]) => {
    if (tab === 'full') markFull(next);
    else markCompact(next);
  };

  const restoreActive = () => {
    const restored = parseReportDocument(activeGenerated);
    if (tab === 'full') {
      setFullBlocks(restored);
      setFullDirty(false);
    } else {
      setCompactBlocks(restored);
      setCompactDirty(false);
    }
    setEditingBlockId(null);
    setEditingSharedKey(null);
  };

  const beginEdit = (block: ReportDocumentBlock) => {
    setEditingBlockId(block.id);
    setEditingSharedKey(getSharedReportBlockKey(block));
  };

  const finishEdit = () => {
    setEditingBlockId(null);
    setEditingSharedKey(null);
  };

  const changeBlock = (blockId: string, nextBlock: ReportDocumentBlock) => {
    const sharedKey = editingBlockId === blockId ? editingSharedKey : getSharedReportBlockKey(activeBlocks.find((block) => block.id === blockId) || nextBlock);
    const nextActive = activeBlocks.map((block) => block.id === blockId ? nextBlock : block);

    if (tab === 'full') {
      markFull(nextActive);
      if (sharedKey) markCompact(syncSharedReportBlock(compactBlocks, sharedKey, nextBlock));
    } else {
      markCompact(nextActive);
      if (sharedKey) markFull(syncSharedReportBlock(fullBlocks, sharedKey, nextBlock));
    }
  };

  const deleteBlock = (blockId: string) => {
    const currentBlock = activeBlocks.find((block) => block.id === blockId);
    const sharedKey = editingBlockId === blockId ? editingSharedKey : currentBlock ? getSharedReportBlockKey(currentBlock) : null;
    const nextActive = activeBlocks.filter((block) => block.id !== blockId);

    if (tab === 'full') {
      markFull(nextActive);
      if (sharedKey) markCompact(removeSharedReportBlock(compactBlocks, sharedKey));
    } else {
      markCompact(nextActive);
      if (sharedKey) markFull(removeSharedReportBlock(fullBlocks, sharedKey));
    }
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
    setEditingBlockId(block.id);
    setEditingSharedKey(null);
    window.setTimeout(() => document.getElementById(`report-block-${block.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  const copyText = async (kind: 'active' | 'both') => {
    const fullDraft = serializeReportDocument(fullBlocks);
    const compactDraft = serializeReportDocument(compactBlocks);
    const text = kind === 'both'
      ? `${fullDraft}\n\n${REPORT_SEPARATOR}\n\n${compactDraft}`
      : activeDraft;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const selectTab = (nextTab: ReportTab) => {
    setTab(nextTab);
    finishEdit();
  };

  return (
    <div className="report-workspace">
      <div className="report-tabs" role="tablist" aria-label="Versão do relatório">
        <button type="button" className={tab === 'full' ? 'active' : ''} onClick={() => selectTab('full')}>Completo</button>
        <button type="button" className={tab === 'compact' ? 'active' : ''} onClick={() => selectTab('compact')}>Resumido</button>
      </div>

      <div className="report-editor-toolbar block-editor-heading">
        <div className="report-version-state">
          <div>
            <strong>{activeLabel}</strong>
            <small>O que você vê nos blocos é o que será copiado.</small>
          </div>
          <span className={activeDirty ? 'edited-badge' : 'automatic-badge'}>{activeDirty ? 'Editado' : 'Automático'}</span>
        </div>
        {activeDirty && <button type="button" className="ghost-button" onClick={restoreActive}>Restaurar</button>}
      </div>

      <div className="report-preview structured-report" aria-label={`Relatório ${activeLabel.toLowerCase()} editável por blocos`}>
        {activeBlocks.map((block, index) => (
          <div id={`report-block-${block.id}`} key={block.id}>
            <BlockCard
              block={block}
              index={index}
              total={activeBlocks.length}
              editing={editingBlockId === block.id}
              linked={Boolean(getSharedReportBlockKey(block) || (editingBlockId === block.id && editingSharedKey))}
              onEdit={() => beginEdit(block)}
              onDone={finishEdit}
              onChange={(nextBlock) => changeBlock(block.id, nextBlock)}
              onDelete={() => deleteBlock(block.id)}
              onMove={(direction) => moveBlock(block.id, direction)}
            />
          </div>
        ))}
        <button className="add-block-button" type="button" onClick={addBlock}>+ Adicionar bloco nesta versão</button>
      </div>

      <div className="report-meta-row">
        <span>{activeDraft.split('\n').length} linhas</span>
        <span>{activeDraft.length.toLocaleString('pt-BR')} caracteres</span>
      </div>

      <div className="report-copy-actions">
        <button className="primary-button" type="button" onClick={() => copyText('active')}>
          {copied === 'active' ? 'Copiado ✓' : `Copiar ${activeLabel.toLowerCase()}`}
        </button>
        <button className="secondary-button" type="button" onClick={() => copyText('both')}>
          {copied === 'both' ? 'Os dois copiados ✓' : 'Copiar completo + resumido'}
        </button>
      </div>
    </div>
  );
}
