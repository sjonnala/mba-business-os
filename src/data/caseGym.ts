import rawGym from './case-gym-drills.json';
import { parseDrills, type Drill } from '../lib/caseGym';

/** The 59 Case Gym drills (10 to 15 per pillar after Wave M7), validated at load time. */
export const DRILLS: readonly Drill[] = parseDrills(rawGym);
