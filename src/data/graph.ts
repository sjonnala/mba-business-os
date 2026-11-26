import rawConcepts from './pillar-1a-acctg500-financial.json';
import { COURSES, PILLARS } from './catalog';
import { checkGraphIntegrity, parseConcepts, type ConceptNode } from '../schema/knowledgeGraph';

/** All validated concept nodes. Parsing throws at load time if the JSON breaks a rule. */
export const CONCEPTS: readonly ConceptNode[] = parseConcepts(rawConcepts);

export const INTEGRITY = checkGraphIntegrity(CONCEPTS, COURSES, PILLARS);

export function conceptById(id: string): ConceptNode | undefined {
  return CONCEPTS.find((c) => c.id === id);
}

export function conceptsForCourse(courseCode: string): ConceptNode[] {
  return CONCEPTS.filter((c) => c.courseCode === courseCode);
}

export const ALL_TAGS: readonly string[] = Array.from(new Set(CONCEPTS.flatMap((c) => c.tags))).sort();
