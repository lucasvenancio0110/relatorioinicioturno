import type { Severity, Shift } from '../domain/types';

export function stripMarkup(value: string): string {
  return value
    .replace(/[\u200e\u2060\u2063\uFEFF]/g, '')
    .replace(/[•●]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[*_]/g, '')
    .replace(/^\s*[.\-]+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonical(value: string): string {
  return stripMarkup(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function normalizeTnl(value: string): string | null {
  const cleaned = stripMarkup(value);
  const match = cleaned.match(/TNL\s*(?:S\s*N[°º]?\s*)?0*(\d{1,3})/i);
  if (!match) return null;
  return `TNL ${String(Number(match[1])).padStart(3, '0')}`;
}

export function extractAllTnls(value: string): string[] {
  const cleaned = stripMarkup(value);
  const direct = [...cleaned.matchAll(/TNL\s*0*(\d{1,3})/gi)].map(
    (m) => `TNL ${String(Number(m[1])).padStart(3, '0')}`,
  );
  if (direct.length) return [...new Set(direct)];

  const compact = cleaned.match(/^0*(\d{1,3}(?:\s*,\s*0*\d{1,3})*)\b/);
  if (!compact) return [];
  return compact[1].split(',').map((n) => `TNL ${String(Number(n.trim())).padStart(3, '0')}`);
}

export function extractSeverity(value: string): Severity {
  if (value.includes('🔴')) return 'red';
  if (value.includes('🔵')) return 'blue';
  if (value.includes('🟢')) return 'green';
  return null;
}

export function extractShift(value: string): Shift | null {
  const c = canonical(value);
  if (/\b(?:1|PRIMEIRO)\s*[°º]?\s*(?:T|TURNO)\b/.test(c) || /\b1T\b/.test(c)) return 1;
  if (/\b(?:2|SEGUNDO)\s*[°º]?\s*(?:T|TURNO)\b/.test(c) || /\b2T\b/.test(c)) return 2;
  if (/\b(?:3|TERCEIRO)\s*[°º]?\s*(?:T|TURNO)\b/.test(c) || /\b3T\b/.test(c)) return 3;
  return null;
}

export function extractTime(value: string): string | null {
  const cleaned = stripMarkup(value);
  let match = cleaned.match(/\b(\d{1,2}):(\d{2})\b/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  match = cleaned.match(/\b(\d{1,2})\s*[hH]\s*(\d{2})\b/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  match = cleaned.match(/\b(\d{1,2})\s*(?:HRS?|HR)\b/i);
  if (match) return `${match[1].padStart(2, '0')}:00`;
  return null;
}

export function cleanDescription(value: string): string {
  let cleaned = stripMarkup(value)
    .replace(/[🔴🔵🟢]/g, ' ')
    .replace(/TNL\s*0*\d{1,3}/gi, ' ')
    .replace(/\b(?:1|2|3)\s*[°º]?\s*(?:T|TURNO)\b/gi, ' ')
    .replace(/\bSETUP\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\s*[hH]\s*\d{2}\b/g, ' ')
    .replace(/^[-:\s]+/, '')
    .replace(/[-.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  if (/^em setup$/i.test(cleaned)) return 'Em Setup';
  if (/^iniciar$/i.test(cleaned) || /^iniciar setup$/i.test(cleaned)) return 'Iniciar';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function isNA(value: string): boolean {
  const c = canonical(value).replace(/[^A-Z0-9]/g, '');
  return c === 'NA';
}

export function titleCaseName(value: string): string {
  const cleaned = stripMarkup(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:FERIAS|FÉRIAS|ATESTADO|ATRASADO|ATRASO|FALTA)\b/gi, ' ')
    .replace(/\s+-\s+.*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toLocaleUpperCase('pt-BR') + part.slice(1))
    .join(' ');
}
