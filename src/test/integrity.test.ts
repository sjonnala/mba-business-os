import { describe, expect, it } from 'vitest';
import { COURSES, PILLARS } from '../data/catalog';
import { CONCEPTS, INTEGRITY } from '../data/graph';
import { checkGraphIntegrity } from '../schema/knowledgeGraph';

describe('graph link integrity', () => {
  it('has no integrity errors', () => {
    expect(INTEGRITY.errors).toEqual([]);
  });

  it('resolves every thread to a concept or a course', () => {
    const ids = new Set([...CONCEPTS.map((c) => c.id), ...COURSES.map((c) => c.id)]);
    for (const c of CONCEPTS) for (const t of c.threadsToPull) expect(ids.has(t.targetId), `${c.id} -> ${t.targetId}`).toBe(true);
  });

  it('links every concept to at least one other concept', () => {
    const conceptIds = new Set(CONCEPTS.map((c) => c.id));
    for (const c of CONCEPTS) expect(c.threadsToPull.some((t) => conceptIds.has(t.targetId)), c.id).toBe(true);
  });

  it('detects broken, self and duplicate links', () => {
    const first = CONCEPTS[0];
    if (!first) throw new Error('no concepts');
    const bad = {
      ...first,
      threadsToPull: [
        { targetId: first.id, relationship: 'builds-on' as const, question: 'Self?' },
        { targetId: 'does-not-exist', relationship: 'builds-on' as const, question: 'Missing?' },
        { targetId: 'does-not-exist', relationship: 'drives' as const, question: 'Dup?' },
      ],
    };
    const report = checkGraphIntegrity([bad], COURSES, PILLARS);
    const joined = report.errors.join('\n');
    expect(joined).toMatch(/itself/);
    expect(joined).toMatch(/does not resolve/);
    expect(joined).toMatch(/duplicate thread/);
  });
});
