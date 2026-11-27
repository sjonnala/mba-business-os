import { describe, expect, it } from 'vitest';
import { DRILLS } from '../data/caseGym';
import { CONCEPTS, conceptById } from '../data/graph';
import { BROWSE_TREE, MAP_LAYOUT, MAP_THREADS, MAP_VIEWBOX } from '../data/mapLayout';
import { LABEL_METRICS, estimateLabelWidth } from '../lib/mapNavigation';
import { RADII } from '../lib/mindMapLayout';

/** The nine GSB and Economics gap concepts added in Wave M7 (M-209), with their course. */
const GAP_PACK: ReadonlyArray<readonly [string, string]> = [
  ['f502-15-trading-comps-valuation-multiples', 'FIN 502'],
  ['f502-16-capital-markets-emh-bond-duration', 'FIN 502'],
  ['be500-03-labor-economics-mrp-ai-automation', 'B ECON 500'],
  ['be500-04-behavioral-economics-choice-architecture', 'B ECON 500'],
  ['be501-03-money-creation-fractional-reserve-qe', 'B ECON 501'],
  ['be501-04-trade-tariffs-fx-supply-chain', 'B ECON 501'],
  ['be501-05-development-institutions-dpi', 'B ECON 501'],
  ['mk501-05-blue-ocean-brand-archetypes-channel-icp', 'MKTG 501'],
  ['m500-04-eq-servant-leadership-network-capital', 'MGMT 500'],
];
const GAP_IDS = new Set(GAP_PACK.map(([id]) => id));

describe('Wave M7 GSB + Economics gap pack', () => {
  it('adds all 9 concepts on the expected courses, for 99 in total', () => {
    for (const [id, course] of GAP_PACK) expect(conceptById(id)?.courseCode, id).toBe(course);
    expect(CONCEPTS).toHaveLength(99);
  });

  it('fills every lens except where a lens is deliberately skipped, and keeps Personal connection concrete', () => {
    for (const [id] of GAP_PACK) {
      const c = conceptById(id);
      const lenses = c ? Object.values(c.lenses) : [];
      expect(lenses.filter((v) => v !== null).length, id).toBeGreaterThanOrEqual(7);
      expect(c?.lenses.personalConnection ?? '', id).toMatch(/Mikesell|Carbon Robotics|Cisco|NVIDIA|GPU|hyperscaler|enterprise|PranaScan|India/);
    }
  });

  it('wires every new concept bidirectionally: out to an earlier concept and in from at least one earlier concept', () => {
    for (const [id] of GAP_PACK) {
      const c = conceptById(id);
      expect(c?.threadsToPull.some((t) => !GAP_IDS.has(t.targetId) && conceptById(t.targetId) !== undefined), id).toBe(true);
      const incoming = CONCEPTS.filter((k) => !GAP_IDS.has(k.id) && k.threadsToPull.some((t) => t.targetId === id));
      expect(incoming.length, id).toBeGreaterThan(0);
    }
  });

  it('draws every new thread on the map, in both directions', () => {
    for (const [id] of GAP_PACK) {
      expect(MAP_THREADS.some((t) => t.sourceId === id), id).toBe(true);
      expect(MAP_THREADS.some((t) => t.targetId === id && !GAP_IDS.has(t.sourceId)), id).toBe(true);
    }
  });

  it('gives each new concept exactly one matching 3-minute drill on its own course', () => {
    for (const [id, course] of GAP_PACK) {
      const drills = DRILLS.filter((d) => d.relatedConceptId === id);
      expect(drills, id).toHaveLength(1);
      expect(drills[0]?.courseCode, id).toBe(course);
      expect(drills[0]?.sourceConceptSlug.startsWith('m209-'), id).toBe(true);
    }
    expect(DRILLS.filter((d) => conceptById(d.relatedConceptId) !== undefined)).toHaveLength(59);
  });

  it('lists all 99 concepts in the browse sidebar', () => {
    const listed = BROWSE_TREE.flatMap((p) => p.courses.flatMap((c) => c.concepts.map((k) => k.id)));
    expect(listed).toHaveLength(99);
    for (const [id] of GAP_PACK) expect(listed, id).toContain(id);
  });

  it('keeps all 99 outer-ring dots at least 45px apart and every label end inside the auto-fit view', () => {
    const concepts = MAP_LAYOUT.nodes.filter((n) => n.kind === 'concept');
    expect(concepts).toHaveLength(99);
    const angles = concepts.map((n) => n.angle).sort((a, b) => a - b);
    const arc = (deg: number) => (deg * Math.PI * RADII.concept) / 180;
    for (let i = 1; i < angles.length; i += 1) expect(arc((angles[i] ?? 0) - (angles[i - 1] ?? 0))).toBeGreaterThan(45);
    // The wrap-around gap between the last and first dot also stays clear.
    expect(arc(360 - ((angles[angles.length - 1] ?? 0) - (angles[0] ?? 0)))).toBeGreaterThan(45);
    for (const n of concepts) {
      const reach = LABEL_METRICS.conceptOffset + estimateLabelWidth(n.label, LABEL_METRICS.conceptFont);
      const rad = (n.angle * Math.PI) / 180;
      const x = n.x + Math.cos(rad) * reach;
      const y = n.y + Math.sin(rad) * reach;
      expect(x >= MAP_VIEWBOX.x && x <= MAP_VIEWBOX.x + MAP_VIEWBOX.width, n.id).toBe(true);
      expect(y >= MAP_VIEWBOX.y && y <= MAP_VIEWBOX.y + MAP_VIEWBOX.height, n.id).toBe(true);
    }
  });
});
