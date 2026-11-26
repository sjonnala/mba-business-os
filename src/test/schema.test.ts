import { describe, expect, it } from 'vitest';
import raw from '../data/pillar-1a-acctg500-financial.json';
import {
  LENS_KEYS,
  countSentences,
  parseConcepts,
  validateConcept,
} from '../schema/knowledgeGraph';

describe('concept JSON schema', () => {
  it('parses every ACCTG 500 node without errors', () => {
    expect(() => parseConcepts(raw)).not.toThrow();
  });

  it('has 15 nodes, all on pillar P1 and course ACCTG 500', () => {
    const nodes = parseConcepts(raw);
    expect(nodes).toHaveLength(15);
    for (const n of nodes) {
      expect(n.pillarId).toBe('P1');
      expect(n.courseCode).toBe('ACCTG 500');
    }
  });

  it('gives every node all 8 lens keys, each 2-3 sentences or null', () => {
    for (const n of parseConcepts(raw)) {
      expect(Object.keys(n.lenses).sort()).toEqual([...LENS_KEYS].sort());
      for (const key of LENS_KEYS) {
        const value = n.lenses[key];
        if (value !== null) {
          expect(countSentences(value)).toBeGreaterThanOrEqual(2);
          expect(countSentences(value)).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('anchors every personalConnection lens to Mikesell, enterprise/GPU economics or PranaScan', () => {
    for (const n of parseConcepts(raw)) {
      const text = n.lenses.personalConnection;
      expect(text, n.id).not.toBeNull();
      expect(text ?? '', n.id).toMatch(/Mikesell|Carbon Robotics|Cisco|GPU|hyperscaler|enterprise|PranaScan/i);
    }
  });

  it('has exactly 2-sentence hooks and at least one formula per node', () => {
    for (const n of parseConcepts(raw)) {
      expect(countSentences(n.hook10k), n.id).toBe(2);
      expect(n.pareto20_80.formulas.length, n.id).toBeGreaterThan(0);
    }
  });

  it('rejects filler, missing lenses, bad tags and wrong hook length', () => {
    const first = (raw as unknown[])[0] as Record<string, unknown>;
    const broken = {
      ...first,
      hook10k: 'Only one sentence here that is long enough to pass the minimum length check for hooks.',
      lenses: { history: 'TBD. TBD.' },
      sources: ['Some source with no tag at all', '[Foster: ACCTG 500] ok source', 'x'],
    };
    const result = validateConcept(broken);
    expect(result.ok).toBe(false);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/hook10k: must be exactly 2 sentences/);
    expect(joined).toMatch(/filler/);
    expect(joined).toMatch(/lenses.economics: missing/);
    expect(joined).toMatch(/malformed tag/);
  });

  it('counts sentences without splitting decimals or dollar figures', () => {
    expect(countSentences('Margin was 64.3% on $49.3B. It fell.')).toBe(2);
  });
});
