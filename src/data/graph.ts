import rawA500 from './pillar-1a-acctg500-financial.json';
import rawA501 from './pillar-1b-acctg501-managerial.json';
import rawP2 from './pillar-2-fin502-entre557-entre542.json';
import rawP3 from './pillar-3-econ-mgmt502-ops-qmeth.json';
import rawP4 from './pillar-4-entre-pm-mikesell.json';
import { COURSES, PILLARS } from './catalog';
import { checkGraphIntegrity, parseConcepts, type ConceptNode } from '../schema/knowledgeGraph';

/** All validated concept nodes. Parsing throws at load time if the JSON breaks a rule. */
export const CONCEPTS: readonly ConceptNode[] = [
  ...parseConcepts(rawA500),
  ...parseConcepts(rawA501),
  ...parseConcepts(rawP2),
  ...parseConcepts(rawP3),
  ...parseConcepts(rawP4),
];

export const INTEGRITY = checkGraphIntegrity(CONCEPTS, COURSES, PILLARS);

export function conceptById(id: string): ConceptNode | undefined {
  return CONCEPTS.find((c) => c.id === id);
}

export function conceptsForCourse(courseCode: string): ConceptNode[] {
  return CONCEPTS.filter((c) => c.courseCode === courseCode);
}

export const ALL_TAGS: readonly string[] = Array.from(new Set(CONCEPTS.flatMap((c) => c.tags))).sort();
