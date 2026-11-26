import { describe, expect, it } from 'vitest';
import rawA500 from '../data/pillar-1a-acctg500-financial.json';
import rawA501 from '../data/pillar-1b-acctg501-managerial.json';
import rawP2 from '../data/pillar-2-fin502-entre557-entre542.json';
import {
  LENS_KEYS,
  countSentences,
  parseConcepts,
  validateConcept,
} from '../schema/knowledgeGraph';

const FILES = [
  { name: 'pillar-1a (ACCTG 500)', raw: rawA500, count: 15, pillar: 'P1', courses: ['ACCTG 500'] },
  { name: 'pillar-1b (ACCTG 501)', raw: rawA501, count: 10, pillar: 'P1', courses: ['ACCTG 501'] },
  { name: 'pillar-2 (FIN 502, ENTRE 557, ENTRE 542)', raw: rawP2, count: 14, pillar: 'P2', courses: ['FIN 502', 'ENTRE 557', 'ENTRE 542'] },
] as const;

describe.each(FILES)('concept JSON schema: $name', ({ raw, count, pillar, courses }) => {
  it('parses every node without errors', () => {
    const errors = (raw as unknown[]).flatMap((n, i) => validateConcept(n).errors.map((e) => `#${i}: ${e}`));
    expect(errors).toEqual([]);
    expect(() => parseConcepts(raw)).not.toThrow();
  });

  it(`has ${count} nodes on the expected pillar and courses`, () => {
    const nodes = parseConcepts(raw);
    expect(nodes).toHaveLength(count);
    for (const n of nodes) {
      expect(n.pillarId).toBe(pillar);
      expect(courses as readonly string[]).toContain(n.courseCode);
    }
    expect(new Set(nodes.map((n) => n.courseCode))).toEqual(new Set(courses));
  });

  it('gives every node all 8 lens keys, each 2-3 sentences or null', () => {
    for (const n of parseConcepts(raw)) {
      expect(Object.keys(n.lenses).sort()).toEqual([...LENS_KEYS].sort());
      for (const key of LENS_KEYS) {
        const value = n.lenses[key];
        if (value !== null) {
          expect(countSentences(value), `${n.id}.${key}`).toBeGreaterThanOrEqual(2);
          expect(countSentences(value), `${n.id}.${key}`).toBeLessThanOrEqual(3);
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
});

describe('Wave M2 cross-pillar wiring', () => {
  it('links every Wave M2 node to at least one node or course outside its own course', () => {
    for (const n of [...parseConcepts(rawA501), ...parseConcepts(rawP2)]) {
      const prefix = n.id.split('-')[0];
      const outside = n.threadsToPull.filter((t) => !t.targetId.startsWith(`${prefix}-`));
      expect(outside.length, n.id).toBeGreaterThan(0);
    }
  });

  it('wires Pillar 2 back to the ACCTG 500 statements and ACCTG 501 to Pillar 2', () => {
    const p2 = parseConcepts(rawP2).flatMap((n) => n.threadsToPull.map((t) => t.targetId));
    const a501 = parseConcepts(rawA501).flatMap((n) => n.threadsToPull.map((t) => t.targetId));
    expect(p2.filter((id) => id.startsWith('a500-')).length).toBeGreaterThanOrEqual(5);
    expect(p2.filter((id) => id.startsWith('a501-')).length).toBeGreaterThanOrEqual(2);
    expect(a501.filter((id) => /^(f502|e557|e542)-/.test(id)).length).toBeGreaterThanOrEqual(4);
  });
});

describe('schema validator', () => {
  it('rejects filler, missing lenses, bad tags and wrong hook length', () => {
    const first = (rawA500 as unknown[])[0] as Record<string, unknown>;
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
