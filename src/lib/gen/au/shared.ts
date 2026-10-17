import { SOLIDS, SYMMETRY, SURVEY_SETS } from './mcq';
export const DIRS_LIST = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
export const SOLIDS_LIST = SOLIDS();
export const SYMMETRY_LIST = SYMMETRY.map(([n, c]) => [n, c] as [string, number]);
export const SURVEY_LIST = SURVEY_SETS as unknown as string[][];
