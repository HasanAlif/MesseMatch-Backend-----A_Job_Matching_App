export const MATCHING_CONFIG = {
  MINIMUM_SCORE_PERCENT: 30,
  MAX_DISTANCE_KM: 500,
  WEIGHTS: {
    skills: 0.45,
    languages: 0.25,
    distance: 0.3,
  },
} as const;
