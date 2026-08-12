import type { SectionKey } from '../domain/types';
import { canonical } from './normalize';

export function detectSection(value: string): SectionKey | null {
  const c = canonical(value).replace(/[.:]+$/g, '').trim();
  if (/^PREPARACAO\b/.test(c)) return 'preparation';
  if (/^PROXIMOS? SETUPS?\b/.test(c)) return 'nextSetups';
  if (/^AJUSTES?\b/.test(c)) return 'adjustment';
  if (/^SELECAO(?: DE ORDENS?)?\b/.test(c)) return 'selection';
  if (/^MANUTENCAO\b/.test(c)) return 'maintenance';
  if (/^DESENVOLVIMENTO\b/.test(c)) return 'development';
  if (/^FALTA\s*\/\s*ATRASO\b/.test(c) || /^FALTA ATRASO\b/.test(c)) return 'absence';
  if (/^OPERADOR(?:ES)? COM 4 MAQUINA(?:S)?\b/.test(c)) return 'operator4';
  if (/^OBSERVACOES?\b/.test(c)) return 'observations';
  return null;
}

export function isAdministrativeLine(value: string): boolean {
  const c = canonical(value);
  return !c || c.includes('BOA TARDE') || c.includes('INICIO DE TURNO') || /^LINHA\b/.test(c) || /^CELULA\b/.test(c);
}
