import { describe, expect, it } from 'vitest';
import factoryFloorCss from '../src/styles/factory-floor.css?raw';
import mainSource from '../src/main.tsx?raw';
import validationHubSource from '../src/app/ValidationHub.tsx?raw';

describe('V6 industrial HMI', () => {
  it('uses an extreme-contrast semantic palette', () => {
    expect(factoryFloorCss).toContain('--hmi-bg:#070908');
    expect(factoryFloorCss).toContain('--hmi-yellow:#ffd400');
    expect(factoryFloorCss).toContain('--hmi-green:#27d667');
    expect(factoryFloorCss).toContain('--hmi-red:#ff453a');
    expect(factoryFloorCss).toContain('--hmi-blue:#3aa8ff');
  });

  it('protects glove-friendly touch targets', () => {
    expect(factoryFloorCss).toMatch(/\.shift-buttons button\{[^}]*min-height:60px/s);
    expect(factoryFloorCss).toMatch(/\.v5-counter-row \.counter-actions button\{[^}]*width:58px[^}]*height:58px/s);
    expect(factoryFloorCss).toMatch(/\.primary-button,[\s\S]*?min-height:60px!important/s);
  });

  it('loads the HMI override after the V5 workspace stylesheet', () => {
    const v5Index = mainSource.indexOf("./styles/v5-workspace.css");
    const hmiIndex = mainSource.indexOf("./styles/factory-floor.css");
    expect(v5Index).toBeGreaterThan(-1);
    expect(hmiIndex).toBeGreaterThan(v5Index);
  });

  it('keeps the validation queue free from motion components', () => {
    expect(validationHubSource).not.toContain('AnimatePresence');
    expect(validationHubSource).not.toContain('motion.button');
    expect(validationHubSource).toContain('validation-row critical');
    expect(validationHubSource).toContain('validation-row confirm');
    expect(validationHubSource).toContain('validation-row overlap');
  });
});
