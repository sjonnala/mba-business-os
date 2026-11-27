import { COURSES, PILLARS } from './catalog';
import { CONCEPTS } from './graph';
import { layoutMindMap } from '../lib/mindMapLayout';
import { allThreads, buildBrowseTree, contentBounds, fitViewBox } from '../lib/mapNavigation';

/** The radial layout of the whole knowledge graph, computed once at load. */
export const MAP_LAYOUT = layoutMindMap(PILLARS, COURSES, CONCEPTS);

/** Every thread edge with both ends on the map. */
export const MAP_THREADS = allThreads(CONCEPTS, MAP_LAYOUT);

/** viewBox that frames every node and label (Wave M6 auto-fit). */
export const MAP_VIEWBOX = fitViewBox(contentBounds(MAP_LAYOUT));

/** Pillar → Course → Concept tree for the browse sidebar. */
export const BROWSE_TREE = buildBrowseTree(PILLARS, COURSES, CONCEPTS);
