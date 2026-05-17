import mongoose from "mongoose";
import { Notification, NotificationType } from "./notification.model";
import {
  notificationService,
  PreloadedNotificationUser,
} from "./notification.service";

export const hasNotificationOfTypeSince = async (
  userId: string,
  type: NotificationType,
  sinceDate: Date,
): Promise<boolean> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) return false;
    const existing = await Notification.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      type,
      createdAt: { $gte: sinceDate },
    })
      .select("_id")
      .lean();
    return !!existing;
  } catch (err) {
    console.error(
      "[notify] hasNotificationOfTypeSince failed:",
      (err as Error).message,
    );
    return false;
  }
};

const DAILY_DIGEST_DEDUP_WINDOW_MS = 12 * 60 * 60 * 1000;

export const notifyDailyJobMatches = async (
  fitterId: string,
  jobCount: number,
  firstJobTitle?: string,
  preloadedUser?: PreloadedNotificationUser,
): Promise<void> => {
  if (jobCount <= 0) return;
  try {
    const dedupSince = new Date(Date.now() - DAILY_DIGEST_DEDUP_WINDOW_MS);
    const alreadySent = await hasNotificationOfTypeSince(
      fitterId,
      NotificationType.DAILY_JOB_MATCHES,
      dedupSince,
    );
    if (alreadySent) return;

    let title: string;
    let body: string;
    if (jobCount === 1) {
      title = "New job for you";
      body = firstJobTitle
        ? `A new job matching your profile: "${firstJobTitle}". Tap to view and apply.`
        : "One new job is matching your profile. Tap to view and apply.";
    } else {
      title = "New jobs for you";
      body = `${jobCount} new jobs posting for you. Open the app to check them out.`;
    }

    const payload = {
      userId: fitterId,
      type: NotificationType.DAILY_JOB_MATCHES,
      title,
      body,
      data: {
        kind: NotificationType.DAILY_JOB_MATCHES,
        jobCount: String(jobCount),
      },
    };

    if (preloadedUser) {
      await notificationService.sendToUserWithDocument(preloadedUser, payload);
    } else {
      await notificationService.sendToUser(payload);
    }
  } catch (err) {
    console.error(
      "[notify] notifyDailyJobMatches failed:",
      (err as Error).message,
    );
  }
};

const PLAN_EXPIRY_COPY: Record<
  30 | 14 | 7,
  { type: NotificationType; title: string }
> = {
  30: {
    type: NotificationType.PLAN_EXPIRING_30D,
    title: "Subscription expiring soon",
  },
  14: {
    type: NotificationType.PLAN_EXPIRING_14D,
    title: "Subscription expiring in 14 days",
  },
  7: {
    type: NotificationType.PLAN_EXPIRING_7D,
    title: "Subscription expiring in 7 days",
  },
};

export const notifyPlanExpiring = async (
  userId: string,
  daysRemaining: 30 | 14 | 7,
  planName: string,
): Promise<void> => {
  try {
    const meta = PLAN_EXPIRY_COPY[daysRemaining];
    if (!meta) return;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const alreadySent = await hasNotificationOfTypeSince(
      userId,
      meta.type,
      sevenDaysAgo,
    );
    if (alreadySent) return;

    const body = `Your ${planName} plan expires in ${daysRemaining} days. Renew now to keep your premium features.`;

    await notificationService.sendToUser({
      userId,
      type: meta.type,
      title: meta.title,
      body,
      data: {
        kind: meta.type,
        plan: planName,
        daysRemaining: String(daysRemaining),
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifyPlanExpiring failed:",
      (err as Error).message,
    );
  }
};
