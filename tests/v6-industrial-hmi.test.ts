import { describe, expect, it } from 'vitest';
import mainSource from '../src/main.tsx?raw';
import appV5Source from '../src/app/AppV5.tsx?raw';
import validationHubSource from '../src/app/ValidationHub.tsx?raw';

describe('V6 industrial HMI', () => {
  it('loads the industrial override after the V5 workspace stylesheet', () => {
    const v5Index = mainSource.indexOf("./styles/v5-workspace.css");
    const hmiIndex = mainSource.indexOf("./styles/factory-floor.css");
    expect(v5Index).toBeGreaterThan(-1);
    expect(hmiIndex).toBeGreaterThan(v5Index);
  });

  it('keeps the main glove-friendly controls addressable by the HMI stylesheet', () => {
    expect(appV5Source).toContain('className="shift-buttons"');
    expect(appV5Source).toContain('className="counter-actions"');
    expect(appV5Source).toContain('className="primary-button"');
    expect(appV5Source).toContain('className="counter-row v5-counter-row"');
  });

  it('keeps the validation queue free from motion components', () => {
    expect(validationHubSource).not.toContain('AnimatePresence');
    expect(validationHubSource).not.toContain('motion.button');
  });

  it('preserves strong semantic states for conflict, confirmation and overlap', () => {
    expect(validationHubSource).toContain('validation-row critical');
    expect(validationHubSource).toContain('validation-row confirm');
    expect(validationHubSource).toContain('validation-row overlap');
    expect(validationHubSource).toContain('CONFLITO');
    expect(validationHubSource).toContain('CONFIRMAR');
    expect(validationHubSource).toContain('SOBREPOSIÇÃO');
  });
});
