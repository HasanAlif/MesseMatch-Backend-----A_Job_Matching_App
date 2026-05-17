import cron from "node-cron";
import mongoose from "mongoose";
import { User, UserRole, UserStatus, Plan, IFcmTokenEntry } from "../models";
import { Job, JobStatus } from "../modules/job/job.model";
import { JobRequest, JobRequestStatus } from "../modules/job/jobRequest.model";
import { computeMatchScore } from "../modules/matching/matching.service";
import { MATCHING_CONFIG } from "../modules/matching/matching.constants";
import {
  notifyDailyJobMatches,
  notifyPlanExpiring,
} from "../modules/notification/notification.daily.helpers";

const DAILY_SCHEDULE = "0 19 * * *";
const TIMEZONE = "Europe/Berlin";
const FITTER_BATCH_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

interface NewJob {
  _id: mongoose.Types.ObjectId;
  projectName: string;
  requieredSkills?: string[];
  requiredLanguages?: string[];
  createdBy: mongoose.Types.ObjectId;
}

interface CompanyForCron {
  _id: mongoose.Types.ObjectId;
  country?: string;
  lattitude?: number;
  longitude?: number;
}

interface FitterForCron {
  _id: mongoose.Types.ObjectId;
  plan?: Plan;
  skills?: string[];
  spokenLanguages?: string[];
  lattitude?: number;
  longitude?: number;
  fcmTokens?: IFcmTokenEntry[];
}

const processPlanExpirations = async (): Promise<void> => {
  const now = Date.now();

  const buckets: Array<{
    days: 30 | 14 | 7;
    onlyPlan?: Plan;
  }> = [
    { days: 30, onlyPlan: Plan.LAUNCH_PREMIUM },
    { days: 14, onlyPlan: Plan.LAUNCH_PREMIUM },
    { days: 7 },
  ];

  for (const bucket of buckets) {
    try {
      const windowStart = new Date(now + (bucket.days - 1) * DAY_MS);
      const windowEnd = new Date(now + bucket.days * DAY_MS);

      const filter: Record<string, unknown> = {
        status: UserStatus.ACTIVE,
        premiumPlanExpiry: { $gt: windowStart, $lte: windowEnd },
        plan: { $ne: Plan.FREE },
      };

      if (bucket.onlyPlan) {
        filter.plan = bucket.onlyPlan;
      }

      const users = await User.find(filter)
        .select("_id plan")
        .lean<{ _id: mongoose.Types.ObjectId; plan?: Plan }[]>();

      if (users.length === 0) continue;

      console.log(
        `[cron] Plan expiry (${bucket.days}d) — ${users.length} users matched`,
      );

      for (const user of users) {
        try {
          await notifyPlanExpiring(
            user._id.toString(),
            bucket.days,
            user.plan ?? "premium",
          );
        } catch (err) {
          console.error(
            `[cron] notifyPlanExpiring failed for user ${user._id}:`,
            (err as Error).message,
          );
        }
      }
    } catch (err) {
      console.error(
        `[cron] processPlanExpirations bucket ${bucket.days}d failed:`,
        (err as Error).message,
      );
    }
  }
};

const processDailyJobMatches = async (): Promise<void> => {
  const since = new Date(Date.now() - DAY_MS);

  const newJobs = await Job.find({
    jobStatus: JobStatus.ACTIVE,
    createdAt: { $gte: since },
  })
    .select("projectName requieredSkills requiredLanguages createdBy")
    .lean<NewJob[]>();

  if (newJobs.length === 0) {
    console.log("[cron] No new jobs in last 24h — skipping daily digest");
    return;
  }

  const companyIds = Array.from(
    new Set(newJobs.map((j) => j.createdBy.toString())),
  ).map((id) => new mongoose.Types.ObjectId(id));

  const companies = await User.find({
    _id: { $in: companyIds },
    role: UserRole.COMPANY,
    status: UserStatus.ACTIVE,
  })
    .select("country lattitude longitude")
    .lean<CompanyForCron[]>();

  const companyMap = new Map<string, CompanyForCron>(
    companies.map((c) => [c._id.toString(), c]),
  );

  const newJobIds = newJobs.map((j) => j._id);
  const existingRequests = await JobRequest.find({
    jobId: { $in: newJobIds },
    requestStatus: {
      $in: [JobRequestStatus.REQUESTED, JobRequestStatus.REJECTED],
    },
  })
    .select("jobId fitterId")
    .lean<
      { jobId: mongoose.Types.ObjectId; fitterId: mongoose.Types.ObjectId }[]
    >();

  const fitterExclusions = new Map<string, Set<string>>();
  for (const req of existingRequests) {
    const fid = req.fitterId.toString();
    if (!fitterExclusions.has(fid)) fitterExclusions.set(fid, new Set());
    fitterExclusions.get(fid)!.add(req.jobId.toString());
  }

  const fitterCursor = User.find({
    role: UserRole.FITTER,
    status: UserStatus.ACTIVE,
  })
    .select("plan skills spokenLanguages lattitude longitude fcmTokens")
    .lean<FitterForCron>()
    .cursor({ batchSize: FITTER_BATCH_SIZE });

  let processedFitters = 0;
  let notifiedFitters = 0;
  let batch: FitterForCron[] = [];

  const flushBatch = async (currentBatch: FitterForCron[]) => {
    await Promise.all(
      currentBatch.map(async (fitter) => {
        try {
          const fitterId = fitter._id.toString();
          const excluded = fitterExclusions.get(fitterId);
          const isPremiumEu = fitter.plan === Plan.PREMIUM_EU;

          let matched = 0;
          let firstMatchTitle: string | undefined;

          for (const job of newJobs) {
            if (excluded && excluded.has(job._id.toString())) continue;

            const company = companyMap.get(job.createdBy.toString());
            if (!company) continue;

            if (!isPremiumEu && company.country !== "Germany") continue;

            const { matchScore } = computeMatchScore(fitter, job, company);

            if (matchScore > MATCHING_CONFIG.MINIMUM_SCORE_PERCENT) {
              matched += 1;
              if (!firstMatchTitle) firstMatchTitle = job.projectName;
            }
          }

          if (matched > 0) {
            notifiedFitters += 1;
            await notifyDailyJobMatches(fitterId, matched, firstMatchTitle, {
              _id: fitter._id,
              fcmTokens: fitter.fcmTokens,
            });
          }
        } catch (err) {
          console.error(
            `[cron] daily match for fitter ${fitter._id} failed:`,
            (err as Error).message,
          );
        }
      }),
    );
  };

  for await (const fitter of fitterCursor) {
    batch.push(fitter);
    processedFitters += 1;
    if (batch.length >= FITTER_BATCH_SIZE) {
      await flushBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch);
  }

  console.log(
    `[cron] Daily job matches digest — ${newJobs.length} new jobs, ` +
      `${processedFitters} fitters scanned, ${notifiedFitters} notified`,
  );
};

export const runDailyNotificationsOnce = async (): Promise<void> => {
  console.log("[cron] Daily notifications run started");
  const startedAt = Date.now();

  try {
    await processPlanExpirations();
  } catch (err) {
    console.error(
      "[cron] processPlanExpirations top-level failure:",
      (err as Error).message,
    );
  }

  try {
    await processDailyJobMatches();
  } catch (err) {
    console.error(
      "[cron] processDailyJobMatches top-level failure:",
      (err as Error).message,
    );
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[cron] Daily notifications run finished in ${elapsedMs}ms`);
};

export const initDailyNotificationsCron = (): void => {
  cron.schedule(
    DAILY_SCHEDULE,
    async () => {
      try {
        await runDailyNotificationsOnce();
      } catch (err) {
        console.error(
          "[cron] Daily notifications scheduled run failed:",
          (err as Error).message,
        );
      }
    },
    { timezone: TIMEZONE },
  );

  console.log(
    `Daily notifications cron scheduled (${DAILY_SCHEDULE}, ${TIMEZONE})`,
  );
};
