import { describe, expect, it } from 'vitest';
import {
  parsePersistedReportWorkspace,
  parsePersistedWorkspace,
} from '../src/storage/workspaceStorage';

const counters = {
  checkpoint: 1,
  cqMachining: 0,
  cqClosing: 2,
  cqReinspection: 0,
  selectionShift1: 0,
  selectionShift2: 3,
  selectionShift3: 0,
  selectionAll: 0,
  selectionTnc: 0,
};

describe('workspace persistence', () => {
  it('restores the operational session after a refresh', () => {
    const serialized = JSON.stringify({
      version: 1,
      savedAt: '2026-08-12T16:10:00.000Z',
      raw: '[12/08/2026, 13:00] Preparador: TNL 087',
      analyzedRaw: '[12/08/2026, 13:00] Preparador: TNL 087',
      shift: 2,
      selectedNextShift: 1,
      snapshot: null,
      counters,
      validatedAttentionIds: ['overlap-flow-TNL 087'],
      analysisVersion: 7,
    });

    const restored = parsePersistedWorkspace(serialized);
    expect(restored?.raw).toContain('TNL 087');
    expect(restored?.shift).toBe(2);
    expect(restored?.selectedNextShift).toBe(1);
    expect(restored?.counters.cqClosing).toBe(2);
    expect(restored?.validatedAttentionIds).toEqual(['overlap-flow-TNL 087']);
    expect(restored?.analysisVersion).toBe(7);
  });

  it('rejects corrupted or incompatible saved sessions instead of breaking the app', () => {
    expect(parsePersistedWorkspace('{broken-json')).toBeNull();
    expect(parsePersistedWorkspace(JSON.stringify({ version: 99 }))).toBeNull();
    expect(parsePersistedWorkspace(JSON.stringify({
      version: 1,
      savedAt: 'x',
      raw: '',
      analyzedRaw: '',
      shift: 2,
      selectedNextShift: 2,
      snapshot: null,
      counters,
      validatedAttentionIds: [],
      analysisVersion: 0,
    }))).toBeNull();
  });

  it('restores report block edits only for the same analysis revision and generated baseline', () => {
    const serialized = JSON.stringify({
      version: 1,
      savedAt: '2026-08-12T16:10:00.000Z',
      revision: 7,
      sourceFullReport: '*SETUP:*\nTNL 087 - Após manutenção',
      sourceCompactReport: '*SETUP:*\nTNL 087 - Após manutenção',
      tab: 'compact',
      fullBlocks: [{ id: 'block-1', lines: [{ id: 'line-1', text: 'SETUP:', bold: true }, { id: 'line-2', text: 'TNL 087 - Confirmado', bold: false }] }],
      compactBlocks: [{ id: 'block-1', lines: [{ id: 'line-1', text: 'SETUP:', bold: true }, { id: 'line-2', text: 'TNL 087 - Confirmado', bold: false }] }],
      fullDirty: true,
      compactDirty: true,
    });

    const restored = parsePersistedReportWorkspace(
      serialized,
      7,
      '*SETUP:*\nTNL 087 - Após manutenção',
      '*SETUP:*\nTNL 087 - Após manutenção',
    );

    expect(restored?.tab).toBe('compact');
    expect(restored?.fullBlocks[0].lines[1].text).toBe('TNL 087 - Confirmado');
    expect(parsePersistedReportWorkspace(serialized, 8, '*SETUP:*\nTNL 087 - Após manutenção', '*SETUP:*\nTNL 087 - Após manutenção')).toBeNull();
    expect(parsePersistedReportWorkspace(serialized, 7, '*OUTRO:*', '*SETUP:*\nTNL 087 - Após manutenção')).toBeNull();
  });
});
