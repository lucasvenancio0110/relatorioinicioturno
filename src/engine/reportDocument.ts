export interface ReportDocumentLine {
  id: string;
  text: string;
  bold: boolean;
}

export interface ReportDocumentBlock {
  id: string;
  lines: ReportDocumentLine[];
}

let localSequence = 0;

function nextId(prefix: string): string {
  localSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${localSequence.toString(36)}`;
}

function parseLine(raw: string, blockIndex: number, lineIndex: number): ReportDocumentLine {
  const trimmed = raw.trim();
  const bold = trimmed.length > 1 && trimmed.startsWith('*') && trimmed.endsWith('*');
  return {
    id: `block-${blockIndex + 1}-line-${lineIndex + 1}`,
    text: bold ? trimmed.slice(1, -1) : raw,
    bold,
  };
}

function canonicalHeading(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[º°]/g, '°')
    .replace(/[^A-Z0-9°]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseReportDocument(text: string): ReportDocumentBlock[] {
  return String(text || '')
    .split(/\n{2,}/)
    .filter((block) => block.length > 0)
    .map((block, blockIndex) => ({
      id: `block-${blockIndex + 1}`,
      lines: block.split('\n').map((line, lineIndex) => parseLine(line, blockIndex, lineIndex)),
    }));
}

export function serializeReportDocument(blocks: ReportDocumentBlock[]): string {
  return blocks
    .filter((block) => block.lines.length > 0)
    .map((block) => block.lines
      .map((line) => line.bold ? `*${line.text}*` : line.text)
      .join('\n'))
    .join('\n\n');
}

export function createReportLine(text = '', bold = false): ReportDocumentLine {
  return { id: nextId('line'), text, bold };
}

export function createReportBlock(title = 'NOVO BLOCO:', firstValue = 'N/A'): ReportDocumentBlock {
  return {
    id: nextId('block'),
    lines: [createReportLine(title, true), createReportLine(firstValue, false)],
  };
}

/**
 * Returns a stable semantic key only for sections that represent the same
 * operational information in both Complete and Summary reports.
 * ORDENS PARA SELEÇÃO is intentionally not linked because the complete report
 * contains manual counters while the summary contains the explicit TNL list.
 */
export function getSharedReportBlockKey(block: ReportDocumentBlock): string | null {
  const heading = block.lines.find((line) => line.bold)?.text || block.lines[0]?.text || '';
  const key = canonicalHeading(heading);

  if (/^\d° TURNO$/.test(key)) return 'REPORT_HEADER';
  if (key === 'MAQUINAS EM MANUTENCAO PARADA') return 'MAINTENANCE_STOPPED';
  if (key === 'MAQUINAS EM MANUTENCAO PRODUZINDO') return 'MAINTENANCE_PRODUCING';
  if (key === 'SETUP') return 'SETUP';
  if (key === 'PROXIMOS SETUPS') return 'UPCOMING_SETUPS';
  if (/^SETUPS \d°T$/.test(key)) return 'NEXT_SHIFT_SETUPS';
  if (key === 'MAQUINAS EM AJUSTES') return 'ADJUSTMENTS';
  return null;
}

function copyBlockContent(target: ReportDocumentBlock, source: ReportDocumentBlock): ReportDocumentBlock {
  return {
    ...target,
    lines: source.lines.map((line, index) => ({
      id: target.lines[index]?.id || createReportLine().id,
      text: line.text,
      bold: line.bold,
    })),
  };
}

export function syncSharedReportBlock(
  targetBlocks: ReportDocumentBlock[],
  sharedKey: string | null,
  sourceBlock: ReportDocumentBlock,
): ReportDocumentBlock[] {
  if (!sharedKey) return targetBlocks;
  const targetIndex = targetBlocks.findIndex((block) => getSharedReportBlockKey(block) === sharedKey);
  if (targetIndex < 0) return targetBlocks;
  return targetBlocks.map((block, index) => index === targetIndex ? copyBlockContent(block, sourceBlock) : block);
}

export function removeSharedReportBlock(targetBlocks: ReportDocumentBlock[], sharedKey: string | null): ReportDocumentBlock[] {
  if (!sharedKey) return targetBlocks;
  return targetBlocks.filter((block) => getSharedReportBlockKey(block) !== sharedKey);
}
