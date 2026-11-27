import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { UnitEconomicsLab } from '../components/UnitEconomicsLab';

describe('UnitEconomicsLab', () => {
  it('renders the Carbon Robotics preset with its headline ratios and sourcing note', () => {
    const html = renderToString(createElement(UnitEconomicsLab));
    expect(html).toContain('LTV/CAC 3.84×');
    expect(html).toContain('payback at sale');
    expect(html).toContain('Sourcing:');
    expect(html).toContain('What moves LTV / CAC?');
  });
});
