import type { Course, Pillar } from '../schema/knowledgeGraph';

/** The five pillars of the MBA Business OS, in build-wave order. */
export const PILLARS: readonly Pillar[] = [
  {
    id: 'P1',
    name: 'Accounting',
    shortName: 'Accounting',
    depthNote: 'Depth priority #1',
    wave: 'M1',
  },
  {
    id: 'P2',
    name: 'Finance, Valuation & VC',
    shortName: 'Finance & VC',
    depthNote: 'Depth priority #2',
    wave: 'M2',
  },
  {
    id: 'P3',
    name: 'Economics, Strategy, Ops & Decision Science',
    shortName: 'Strategy & Ops',
    depthNote: 'Extra depth on MGMT 502 Business Strategy',
    wave: 'M3',
  },
  {
    id: 'P4',
    name: 'SWE → AI Founder & Strategic PM',
    shortName: 'AI Founder & PM',
    depthNote: 'Anchored in the Paul Mikesell playbook',
    wave: 'M4',
  },
  {
    id: 'P5',
    name: 'Marketing, Leadership & Board Governance',
    shortName: 'Leadership & Boards',
    depthNote: 'Extra depth on MGMT 550 CEO & Board Governance',
    wave: 'M5',
  },
];

/**
 * The 22 UW Foster courses. MGMT 510 and B CMU 501 share one slot, as listed together
 * ("MGMT 510 / B CMU 501") in the action plan, which is what makes the count 22.
 */
export const COURSES: readonly Course[] = [
  // Pillar 1: Accounting
  { id: 'ACCTG500', code: 'ACCTG 500', title: 'Financial Accounting', pillarId: 'P1', wave: 'M1', status: 'live' },
  { id: 'ACCTG501', code: 'ACCTG 501', title: 'Managerial Accounting', pillarId: 'P1', wave: 'M2', status: 'live' },
  // Pillar 2: Finance, Valuation & VC
  { id: 'FIN502', code: 'FIN 502', title: 'Business Finance', pillarId: 'P2', wave: 'M2', status: 'live' },
  { id: 'ENTRE557', code: 'ENTRE 557', title: 'Entrepreneurial Finance', pillarId: 'P2', wave: 'M2', status: 'live' },
  { id: 'ENTRE542', code: 'ENTRE 542', title: 'Venture Capital', pillarId: 'P2', wave: 'M2', status: 'live' },
  // Pillar 3: Economics, Strategy, Ops & Decision Science
  { id: 'BECON500', code: 'B ECON 500', title: 'Intro Business Economics', pillarId: 'P3', wave: 'M3', status: 'live' },
  { id: 'BECON501', code: 'B ECON 501', title: 'Global Economic Conditions', pillarId: 'P3', wave: 'M3', status: 'live' },
  { id: 'MGMT502', code: 'MGMT 502', title: 'Business Strategy', pillarId: 'P3', wave: 'M3', status: 'live' },
  { id: 'OPMGT502', code: 'OPMGT 502', title: 'Operations Management', pillarId: 'P3', wave: 'M3', status: 'live' },
  { id: 'QMETH500', code: 'QMETH 500', title: 'Statistical Analysis', pillarId: 'P3', wave: 'M3', status: 'live' },
  { id: 'QMETH501', code: 'QMETH 501', title: 'Decision Support Models', pillarId: 'P3', wave: 'M3', status: 'live' },
  { id: 'IS500', code: 'I S 500', title: 'Data Management & Analytics', pillarId: 'P3', wave: 'M3', status: 'live' },
  // Pillar 4: SWE -> AI Founder & Strategic PM
  { id: 'ENTRE510', code: 'ENTRE 510', title: 'Entrepreneurial Strategy', pillarId: 'P4', wave: 'M4', status: 'live' },
  { id: 'ENTRE532', code: 'ENTRE 532', title: 'Software Entrepreneurship', pillarId: 'P4', wave: 'M4', status: 'live' },
  { id: 'ENTRE579', code: 'ENTRE 579', title: 'Special Topics in Entrepreneurship', pillarId: 'P4', wave: 'M4', status: 'live' },
  { id: 'MKTG554', code: 'MKTG 554', title: 'Strategic Product Management', pillarId: 'P4', wave: 'M4', status: 'live' },
  // Pillar 5: Marketing, Leadership & Board Governance
  { id: 'MKTG501', code: 'MKTG 501', title: 'Marketing Management', pillarId: 'P5', wave: 'M5', status: 'live' },
  { id: 'MKTG600', code: 'MKTG 600', title: 'Independent Study (Mojang)', pillarId: 'P5', wave: 'M5', status: 'live' },
  { id: 'MGMT500', code: 'MGMT 500', title: 'Management & Leadership', pillarId: 'P5', wave: 'M5', status: 'live' },
  {
    id: 'MGMT510-BCMU501',
    code: 'MGMT 510 / B CMU 501',
    title: 'Developing Leader Skills / Professional Communication',
    pillarId: 'P5',
    wave: 'M5',
    status: 'live',
  },
  { id: 'MGMT504', code: 'MGMT 504', title: 'Ethical Leadership', pillarId: 'P5', wave: 'M5', status: 'live' },
  { id: 'MGMT550', code: 'MGMT 550', title: 'CEO & Board Governance', pillarId: 'P5', wave: 'M5', status: 'live' },
];

export function comingLabel(course: Course): string {
  return course.status === 'live' ? 'Live' : `Coming in Wave ${course.wave}`;
}
