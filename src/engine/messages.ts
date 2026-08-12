import type { SourceMessage } from '../domain/types';
import { canonical, stripMarkup } from './normalize';

const whatsappHeader = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)$/;

export function splitMessages(raw: string): SourceMessage[] {
  const lines = String(raw || '').replace(/\r/g, '').split('\n');
  const chunks: Array<{ sender?: string; timestamp?: string; lines: string[] }> = [];
  let current: { sender?: string; timestamp?: string; lines: string[] } | null = null;

  for (const line of lines) {
    const header = line.match(whatsappHeader);
    if (header) {
      if (current) chunks.push(current);
      current = {
        sender: stripMarkup(header[3]).replace(/^~\s*/, ''),
        timestamp: `${header[1]} ${header[2]}`,
        lines: [header[4]],
      };
      continue;
    }
    if (!current) current = { lines: [] };
    current.lines.push(line);
  }
  if (current) chunks.push(current);

  return chunks
    .map((chunk, index) => {
      const body = chunk.lines.join('\n').trim();
      const lineMatch = canonical(body).match(/(?:LINHA\s*(?:N[°º]?\s*)?|LINHA\s+)([\d.\/ -]+)/);
      return {
        id: `msg-${index + 1}`,
        sender: chunk.sender,
        timestamp: chunk.timestamp,
        line: lineMatch?.[1]?.trim(),
        raw: chunk.lines.join('\n'),
        body,
      } satisfies SourceMessage;
    })
    .filter((message) => message.body.length > 0);
}
