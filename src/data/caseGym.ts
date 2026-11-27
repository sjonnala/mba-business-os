import rawGym from './case-gym-50-drills.json';
import { parseDrills, type Drill } from '../lib/caseGym';

/** The 50 Case Gym drills (10 per pillar), validated at load time. */
export const DRILLS: readonly Drill[] = parseDrills(rawGym);
