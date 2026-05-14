import cron from "node-cron";
import { User } from "../models";

const MONTHLY_RESET_SCHEDULE = "0 0 1 * *";

const resetAllSwipeCounts = async (): Promise<void> => {
  const now = new Date();
  const result = await User.updateMany(
    {},
    { $set: { swipeCount: 0, swipeCountResetAt: now } },
  );
  console.log(
    `[cron] Monthly swipeCount reset complete — matched: ${result.matchedCount}, modified: ${result.modifiedCount}`,
  );
};

export const initSwipeCountResetCron = (): void => {
  cron.schedule(
    MONTHLY_RESET_SCHEDULE,
    async () => {
      try {
        await resetAllSwipeCounts();
      } catch (error) {
        console.error("[cron] Monthly swipeCount reset failed:", error);
      }
    },
    { timezone: "Europe/Berlin" },
  );

  console.log(
    `Swipe count monthly reset cron scheduled (${MONTHLY_RESET_SCHEDULE}, Europe/Berlin)`,
  );
};
