import { Plan } from "../../models";

export const PLAN_DURATION_DAYS: Record<Plan, number | null> = {
  [Plan.FREE]: null,
  [Plan.BASIC]: 30,
  [Plan.PREMIUM]: 30,
  [Plan.PREMIUM_DE]: 30,
  [Plan.PREMIUM_EU]: 30,
  [Plan.LAUNCH_PREMIUM]: 180,
};

export const JOB_CREATION_LIMITS: Record<Plan, number> = {
  [Plan.FREE]: 0,
  [Plan.BASIC]: 5,
  [Plan.LAUNCH_PREMIUM]: 5,
  [Plan.PREMIUM]: 12,
  [Plan.PREMIUM_DE]: 12,
  [Plan.PREMIUM_EU]: 12,
};

export const JOB_CREATION_WARN_AT: Record<Plan, number | null> = {
  [Plan.FREE]: null,
  [Plan.BASIC]: 3,
  [Plan.LAUNCH_PREMIUM]: 3,
  [Plan.PREMIUM]: 10,
  [Plan.PREMIUM_DE]: 10,
  [Plan.PREMIUM_EU]: 10,
};

export const SWIPE_LIMITS: Record<Plan, number | null> = {
  [Plan.FREE]: 30,
  [Plan.PREMIUM_DE]: null,
  [Plan.PREMIUM_EU]: null,
  [Plan.LAUNCH_PREMIUM]: null,
  [Plan.BASIC]: null,
  [Plan.PREMIUM]: null,
};

export const SWIPE_WARN_AT = 20;

export const getPlanDurationMs = (plan: Plan): number | null => {
  const days = PLAN_DURATION_DAYS[plan];
  return days === null ? null : days * 24 * 60 * 60 * 1000;
};
