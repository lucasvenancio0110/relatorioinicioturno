import { useEffect, useMemo, useState } from 'react';
import { REPORT_SEPARATOR } from '../engine/reports';

type ReportTab = 'full' | 'compact';
type EditorMode = 'preview' | 'edit';

interface ReportEditorProps {
  fullReport: string;
  compactReport: string;
}

function ReportPreview({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/\n{2,}/).filter(Boolean), [text]);

  return (
    <div className="report-preview" aria-label="Prévia do relatório">
      {blocks.map((block, blockIndex) => (
        <div className="report-preview-block" key={`${blockIndex}-${block.slice(0, 18)}`}>
          {block.split('\n').map((line, lineIndex) => {
            const trimmed = line.trim();
            const bold = trimmed.length > 1 && trimmed.startsWith('*') && trimmed.endsWith('*');
            const content = bold ? trimmed.slice(1, -1) : line;
            return (
              <div className={bold ? 'report-preview-line heading' : 'report-preview-line'} key={`${lineIndex}-${line}`}>
                {content || '\u00A0'}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function ReportEditor({ fullReport, compactReport }: ReportEditorProps) {
  const [tab, setTab] = useState<ReportTab>('full');
  const [mode, setMode] = useState<EditorMode>('preview');
  const [fullDraft, setFullDraft] = useState(fullReport);
  const [compactDraft, setCompactDraft] = useState(compactReport);
  const [fullDirty, setFullDirty] = useState(false);
  const [compactDirty, setCompactDirty] = useState(false);
  const [copied, setCopied] = useState<'active' | 'both' | null>(null);

  useEffect(() => {
    if (!fullDirty) setFullDraft(fullReport);
  }, [fullReport, fullDirty]);

  useEffect(() => {
    if (!compactDirty) setCompactDraft(compactReport);
  }, [compactReport, compactDirty]);

  const activeDraft = tab === 'full' ? fullDraft : compactDraft;
  const activeDirty = tab === 'full' ? fullDirty : compactDirty;
  const activeLabel = tab === 'full' ? 'Completo' : 'Resumido';

  const updateActive = (value: string) => {
    if (tab === 'full') {
      setFullDraft(value);
      setFullDirty(value !== fullReport);
    } else {
      setCompactDraft(value);
      setCompactDirty(value !== compactReport);
    }
  };

  const restoreActive = () => {
    if (tab === 'full') {
      setFullDraft(fullReport);
      setFullDirty(false);
    } else {
      setCompactDraft(compactReport);
      setCompactDirty(false);
    }
  };

  const copyText = async (kind: 'active' | 'both') => {
    const text = kind === 'both'
      ? `${fullDraft}\n\n${REPORT_SEPARATOR}\n\n${compactDraft}`
      : activeDraft;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="report-workspace">
      <div className="report-tabs" role="tablist" aria-label="Versão do relatório">
        <button type="button" className={tab === 'full' ? 'active' : ''} onClick={() => setTab('full')}>Completo</button>
        <button type="button" className={tab === 'compact' ? 'active' : ''} onClick={() => setTab('compact')}>Resumido</button>
      </div>

      <div className="report-editor-toolbar">
        <div className="report-version-state">
          <strong>Relatório {activeLabel.toLowerCase()}</strong>
          <span className={activeDirty ? 'edited-badge' : 'automatic-badge'}>{activeDirty ? 'Editado manualmente' : 'Sincronizado com o motor'}</span>
        </div>
        <div className="report-editor-actions">
          {activeDirty && <button type="button" className="ghost-button" onClick={restoreActive}>Restaurar</button>}
          <div className="view-switch">
            <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>Visualizar</button>
            <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>Editar</button>
          </div>
        </div>
      </div>

      {mode === 'preview' ? (
        <ReportPreview text={activeDraft} />
      ) : (
        <textarea
          className="report-text-editor"
          value={activeDraft}
          onChange={(event) => updateActive(event.target.value)}
          spellCheck={false}
          aria-label={`Editar relatório ${activeLabel.toLowerCase()}`}
        />
      )}

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
