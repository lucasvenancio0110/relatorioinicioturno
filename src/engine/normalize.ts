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
  const match = cleaned.match(/TNL\s*(?:S?\s*N[°º]?\s*)?0*(\d{1,3})/i);
  if (!match) return null;
  return `TNL ${String(Number(match[1])).padStart(3, '0')}`;
}

export function extractAllTnls(value: string): string[] {
  const cleaned = stripMarkup(value).replace(/TNL\s*S?\s*N[°º]?\s*/gi, 'TNL ');

  const grouped = cleaned.match(/TNL\s*0*(\d{1,3}(?:\s*,\s*(?:TNL\s*)?0*\d{1,3})+)/i);
  if (grouped) {
    return [...new Set(grouped[1]
      .split(',')
      .map((part) => part.replace(/TNL\s*/i, '').trim())
      .filter(Boolean)
      .map((n) => `TNL ${String(Number(n)).padStart(3, '0')}`))];
  }

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
  if (/\bPRIMEIRO(?:\s+TURNO)?\b/.test(c) || /\b1\s*[°º]?\s*(?:T|TURNO)\b/.test(c) || /\b1T\b/.test(c)) return 1;
  if (/\bSEGUNDO(?:\s+TURNO)?\b/.test(c) || /\b2\s*[°º]?\s*(?:T|TURNO)\b/.test(c) || /\b2T\b/.test(c)) return 2;
  if (/\bTERCEIRO(?:\s+TURNO)?\b/.test(c) || /\b3\s*[°º]?\s*(?:T|TURNO)\b/.test(c) || /\b3T\b/.test(c)) return 3;
  return null;
}

export function extractTime(value: string): string | null {
  const cleaned = stripMarkup(value);
  let match = cleaned.match(/\b(\d{1,2}):(\d{2})\b/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  match = cleaned.match(/\b(\d{1,2})\s*[hH]\s*(\d{2})\s*m?\b/i);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  match = cleaned.match(/\b(\d{1,2})\s*(?:HRS?|HR|H)\b/i);
  if (match) return `${match[1].padStart(2, '0')}:00`;
  return null;
}

export function cleanDescription(value: string): string {
  const semantic = canonical(value);
  if (/\b(?:MAQUINA\s+)?EM\s+SETUP\b/.test(semantic) || /\bSETUP\s+EM\s+ANDAMENTO\b/.test(semantic)) return 'Em Setup';
  if (/\bAGUARDANDO\s+SETUP\b/.test(semantic)) return 'Aguardando setup';
  if (/\bINICIAR(?:\s+SETUP)?\b/.test(semantic)) return 'Iniciar';
  if (/\bINICIANDO\b/.test(semantic)) return 'Iniciando';
  if (/\bINICIADO\b/.test(semantic)) return 'Iniciado';

  let cleaned = stripMarkup(value)
    .replace(/[🔴🔵🟢]/g, ' ')
    .replace(/TNL\s*(?:S?\s*N[°º]?\s*)?0*\d{1,3}(?:\s*,\s*(?:TNL\s*)?0*\d{1,3})*/gi, ' ')
    .replace(/^0*\d{1,3}(?:\s*,\s*0*\d{1,3})*\s*/, ' ')
    .replace(/\b(?:PRIMEIRO|SEGUNDO|TERCEIRO)(?:\s+TURNO)?\b/gi, ' ')
    .replace(/\b(?:1|2|3)\s*[°º]?\s*(?:T|TURNO)\b/gi, ' ')
    .replace(/\bSETUP\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}\s*[hH]\s*\d{2}\s*m?\b/gi, ' ')
    .replace(/\b\d{1,2}\s*(?:HRS?|HR|H)\b/gi, ' ')
    .replace(/^[-:,\s]+/, '')
    .replace(/[-.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function cleanOperationalText(value: string): string {
  return stripMarkup(value)
    .replace(/<\s*mensagem editada\s*>/gi, ' ')
    .replace(/^mensagem editada$/gi, ' ')
    .replace(/[\s.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNA(value: string): boolean {
  const c = canonical(value).replace(/[^A-Z0-9]/g, '');
  return c === 'NA';
}

export function titleCaseName(value: string): string {
  const cleaned = stripMarkup(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:FERIAS|FÉRIAS|ATESTADOS?|ATRASADOS?|ATRASOS?|FALTAS?)\b/gi, ' ')
    .replace(/\s+-\s+.*$/, ' ')
    .replace(/\/.*$/g, ' ')
    .replace(/^[-\s]+|[-\s]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toLocaleUpperCase('pt-BR') + part.slice(1))
    .join(' ');
}
