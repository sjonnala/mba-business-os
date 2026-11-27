/**
 * Knowledge-graph schema for the MBA Business OS.
 *
 * Every concept node follows the same mental-model routine:
 * 10K-Foot Hook -> 20/80 -> Reality Check -> 8 Lenses -> Threads to Pull -> 3-Min Drill -> Sources.
 *
 * Data files are JSON (so they stay portable and easy to mirror to Drive). They enter the app
 * only through `parseConcepts`, which validates every field at runtime and returns typed nodes,
 * so the TypeScript types and the JSON content can never silently drift apart.
 */

export const PILLAR_IDS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
export type PillarId = (typeof PILLAR_IDS)[number];

export const WAVES = ['M1', 'M2', 'M3', 'M4', 'M5'] as const;
export type Wave = (typeof WAVES)[number];

export const DIFFICULTIES = ['foundation', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const LENS_KEYS = [
  'history',
  'economics',
  'behavioralScience',
  'marketingNarrative',
  'sociology',
  'firstPrinciplesContrarian',
  'personalConnection',
  'antiPattern',
] as const;
export type LensKey = (typeof LENS_KEYS)[number];

export const LENS_LABELS: Record<LensKey, string> = {
  history: 'History',
  economics: 'Economics',
  behavioralScience: 'Behavioral science',
  marketingNarrative: 'Marketing & narrative',
  sociology: 'Sociology',
  firstPrinciplesContrarian: 'First principles / contrarian',
  personalConnection: 'Personal connection',
  antiPattern: 'Anti-pattern',
};

/** `null` means "Low signal — skipped": the lens does not genuinely illuminate this concept. */
export type Lenses = Record<LensKey, string | null>;
export const LOW_SIGNAL_LABEL = 'Low signal — skipped';

export const RELATIONSHIPS = [
  'builds-on',
  'foundation-for',
  'contrasts-with',
  'drives',
  'measured-by',
  'risk-for',
  'applied-in',
] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export interface Thread {
  /** A concept id, or a course id (e.g. "FIN502") for cross-pillar links to future waves. */
  targetId: string;
  relationship: Relationship;
  question: string;
}

export interface Formula {
  name: string;
  expression: string;
}

export interface Pareto {
  summary: string;
  keyPoints: string[];
  formulas: Formula[];
}

export interface BoardroomDrill {
  companyOrScenario: string;
  prompt: string;
  cfoAnswer: string;
  keyTakeaway: string;
}

export interface ConceptNode {
  id: string;
  pillarId: PillarId;
  courseCode: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  hook10k: string;
  pareto20_80: Pareto;
  realityCheck: string[];
  lenses: Lenses;
  threadsToPull: Thread[];
  boardroomDrill: BoardroomDrill;
  sources: string[];
}

export interface Pillar {
  id: PillarId;
  name: string;
  shortName: string;
  depthNote: string;
  wave: Wave;
}

export type CourseStatus = 'live' | 'coming';

export interface Course {
  /** Stable id without spaces, e.g. "ACCTG500". */
  id: string;
  /** Code as printed by UW Foster, e.g. "ACCTG 500". */
  code: string;
  title: string;
  pillarId: PillarId;
  wave: Wave;
  status: CourseStatus;
}

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

export const SOURCE_TAG_PATTERN =
  /^\[(Foster: [A-Z]+(?: [A-Z]+)? \d{3}|Elite MBA: [^\]]+|Real 10-K \/ Case)\] \S/;

/** Words that signal placeholder filler rather than content. */
const FILLER_PATTERN = /\b(TBD|TODO|lorem|ipsum|placeholder|N\/A)\b|Low signal/i;

/**
 * Counts sentences: a run of text ending in . ! or ? (optionally followed by a closing quote or
 * bracket) and then whitespace or end of string. Decimals like 1.5 and "$1.4M" are not split.
 * Content avoids abbreviations ending in a period (we write "versus", "US", "for example").
 */
export function countSentences(text: string): number {
  const matches = text.trim().match(/[.!?]["')\]]*(?=\s|$)/g);
  return matches ? matches.length : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}

interface Checker {
  errors: string[];
  text(path: string, value: unknown, minLength?: number): string;
  textArray(path: string, value: unknown, minItems: number, minLength?: number): string[];
}

function makeChecker(): Checker {
  const errors: string[] = [];
  const text = (path: string, value: unknown, minLength = 20): string => {
    if (typeof value !== 'string') {
      errors.push(`${path}: expected string`);
      return '';
    }
    const trimmed = value.trim();
    if (trimmed.length < minLength) errors.push(`${path}: too short (${trimmed.length} < ${minLength})`);
    if (FILLER_PATTERN.test(trimmed)) errors.push(`${path}: contains filler text`);
    return trimmed;
  };
  const textArray = (path: string, value: unknown, minItems: number, minLength = 20): string[] => {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`);
      return [];
    }
    if (value.length < minItems) errors.push(`${path}: needs at least ${minItems} items`);
    return value.map((item, i) => text(`${path}[${i}]`, item, minLength));
  };
  return { errors, text, textArray };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  node: ConceptNode | null;
}

/** Validates one raw concept object (shape + content rules). Cross-node link integrity is separate. */
export function validateConcept(raw: unknown, index = 0): ValidationResult {
  const c = makeChecker();
  const where = isRecord(raw) && typeof raw.id === 'string' ? raw.id : `concept[${index}]`;
  if (!isRecord(raw)) {
    return { ok: false, errors: [`${where}: expected object`], node: null };
  }

  const id = c.text(`${where}.id`, raw.id, 3);
  if (id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) c.errors.push(`${where}.id: must be kebab-case`);

  const pillarId = raw.pillarId;
  if (!isOneOf(PILLAR_IDS, pillarId)) c.errors.push(`${where}.pillarId: unknown pillar`);
  const courseCode = c.text(`${where}.courseCode`, raw.courseCode, 5);
  const title = c.text(`${where}.title`, raw.title, 8);
  const difficulty = raw.difficulty;
  if (!isOneOf(DIFFICULTIES, difficulty)) c.errors.push(`${where}.difficulty: invalid`);
  const tags = c.textArray(`${where}.tags`, raw.tags, 2, 2);

  const hook10k = c.text(`${where}.hook10k`, raw.hook10k, 80);
  if (hook10k && countSentences(hook10k) !== 2) {
    c.errors.push(`${where}.hook10k: must be exactly 2 sentences (found ${countSentences(hook10k)})`);
  }

  let pareto: Pareto = { summary: '', keyPoints: [], formulas: [] };
  if (!isRecord(raw.pareto20_80)) {
    c.errors.push(`${where}.pareto20_80: expected object`);
  } else {
    const p = raw.pareto20_80;
    const formulas: Formula[] = [];
    if (!Array.isArray(p.formulas) || p.formulas.length < 1) {
      c.errors.push(`${where}.pareto20_80.formulas: needs at least 1 formula`);
    } else {
      p.formulas.forEach((f: unknown, i: number) => {
        if (!isRecord(f)) {
          c.errors.push(`${where}.pareto20_80.formulas[${i}]: expected object`);
          return;
        }
        formulas.push({
          name: c.text(`${where}.pareto20_80.formulas[${i}].name`, f.name, 3),
          expression: c.text(`${where}.pareto20_80.formulas[${i}].expression`, f.expression, 5),
        });
      });
    }
    pareto = {
      summary: c.text(`${where}.pareto20_80.summary`, p.summary, 80),
      keyPoints: c.textArray(`${where}.pareto20_80.keyPoints`, p.keyPoints, 3, 30),
      formulas,
    };
  }

  const realityCheck = c.textArray(`${where}.realityCheck`, raw.realityCheck, 2, 40);

  const lenses = {} as Lenses;
  if (!isRecord(raw.lenses)) {
    c.errors.push(`${where}.lenses: expected object`);
  } else {
    const rawLenses = raw.lenses;
    const extra = Object.keys(rawLenses).filter((k) => !isOneOf(LENS_KEYS, k));
    if (extra.length > 0) c.errors.push(`${where}.lenses: unknown keys ${extra.join(', ')}`);
    for (const key of LENS_KEYS) {
      if (!(key in rawLenses)) {
        c.errors.push(`${where}.lenses.${key}: missing (use null for "${LOW_SIGNAL_LABEL}")`);
        lenses[key] = null;
        continue;
      }
      const value = rawLenses[key];
      if (value === null) {
        lenses[key] = null;
        continue;
      }
      const lensText = c.text(`${where}.lenses.${key}`, value, 60);
      const n = countSentences(lensText);
      if (lensText && (n < 2 || n > 3)) {
        c.errors.push(`${where}.lenses.${key}: must be 2-3 sentences (found ${n})`);
      }
      lenses[key] = lensText;
    }
  }

  const threads: Thread[] = [];
  if (!Array.isArray(raw.threadsToPull) || raw.threadsToPull.length < 2) {
    c.errors.push(`${where}.threadsToPull: needs at least 2 threads`);
  } else {
    raw.threadsToPull.forEach((t: unknown, i: number) => {
      const tp = `${where}.threadsToPull[${i}]`;
      if (!isRecord(t)) {
        c.errors.push(`${tp}: expected object`);
        return;
      }
      if (!isOneOf(RELATIONSHIPS, t.relationship)) c.errors.push(`${tp}.relationship: invalid`);
      const question = c.text(`${tp}.question`, t.question, 20);
      if (question && !question.endsWith('?')) c.errors.push(`${tp}.question: must end with "?"`);
      threads.push({
        targetId: c.text(`${tp}.targetId`, t.targetId, 3),
        relationship: isOneOf(RELATIONSHIPS, t.relationship) ? t.relationship : 'builds-on',
        question,
      });
    });
  }

  let drill: BoardroomDrill = { companyOrScenario: '', prompt: '', cfoAnswer: '', keyTakeaway: '' };
  if (!isRecord(raw.boardroomDrill)) {
    c.errors.push(`${where}.boardroomDrill: expected object`);
  } else {
    const d = raw.boardroomDrill;
    drill = {
      companyOrScenario: c.text(`${where}.boardroomDrill.companyOrScenario`, d.companyOrScenario, 8),
      prompt: c.text(`${where}.boardroomDrill.prompt`, d.prompt, 80),
      cfoAnswer: c.text(`${where}.boardroomDrill.cfoAnswer`, d.cfoAnswer, 120),
      keyTakeaway: c.text(`${where}.boardroomDrill.keyTakeaway`, d.keyTakeaway, 30),
    };
  }

  const sources = c.textArray(`${where}.sources`, raw.sources, 3, 20);
  sources.forEach((s, i) => {
    if (s && !SOURCE_TAG_PATTERN.test(s)) c.errors.push(`${where}.sources[${i}]: missing or malformed tag`);
  });
  if (!sources.some((s) => s.startsWith('[Foster: '))) {
    c.errors.push(`${where}.sources: needs at least one [Foster: ...] source`);
  }

  if (c.errors.length > 0 || !isOneOf(PILLAR_IDS, pillarId) || !isOneOf(DIFFICULTIES, difficulty)) {
    return { ok: false, errors: c.errors, node: null };
  }
  return {
    ok: true,
    errors: [],
    node: {
      id,
      pillarId,
      courseCode,
      title,
      difficulty,
      tags,
      hook10k,
      pareto20_80: pareto,
      realityCheck,
      lenses,
      threadsToPull: threads,
      boardroomDrill: drill,
      sources,
    },
  };
}

/** Validates an array of raw concepts; throws with every error listed if any node is invalid. */
export function parseConcepts(raw: unknown): ConceptNode[] {
  if (!Array.isArray(raw)) throw new Error('Concept file must be a JSON array');
  const nodes: ConceptNode[] = [];
  const errors: string[] = [];
  raw.forEach((item: unknown, i: number) => {
    const result = validateConcept(item, i);
    if (result.node) nodes.push(result.node);
    errors.push(...result.errors);
  });
  if (errors.length > 0) throw new Error(`Invalid concept data:\n${errors.join('\n')}`);
  return nodes;
}

export interface IntegrityReport {
  errors: string[];
}

/** Cross-node checks: unique ids, known courses/pillars, and resolvable, non-self thread links. */
export function checkGraphIntegrity(
  concepts: readonly ConceptNode[],
  courses: readonly Course[],
  pillars: readonly Pillar[],
): IntegrityReport {
  const errors: string[] = [];
  const conceptIds = new Set<string>();
  for (const c of concepts) {
    if (conceptIds.has(c.id)) errors.push(`duplicate concept id ${c.id}`);
    conceptIds.add(c.id);
  }
  const courseByCode = new Map(courses.map((c) => [c.code, c]));
  const courseIds = new Set(courses.map((c) => c.id));
  const pillarIds = new Set(pillars.map((p) => p.id));
  for (const c of concepts) {
    const course = courseByCode.get(c.courseCode);
    if (!course) errors.push(`${c.id}: unknown course ${c.courseCode}`);
    else if (course.pillarId !== c.pillarId) errors.push(`${c.id}: pillar ${c.pillarId} != course pillar`);
    if (!pillarIds.has(c.pillarId)) errors.push(`${c.id}: unknown pillar ${c.pillarId}`);
    const seen = new Set<string>();
    for (const t of c.threadsToPull) {
      if (t.targetId === c.id) errors.push(`${c.id}: thread points to itself`);
      if (!conceptIds.has(t.targetId) && !courseIds.has(t.targetId)) {
        errors.push(`${c.id}: thread target ${t.targetId} does not resolve`);
      }
      if (seen.has(t.targetId)) errors.push(`${c.id}: duplicate thread to ${t.targetId}`);
      seen.add(t.targetId);
    }
  }
  return { errors };
}
