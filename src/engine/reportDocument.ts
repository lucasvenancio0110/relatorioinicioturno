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
