import { notificationService } from "../notification/notification.service";
import { NotificationType } from "../notification/notification.model";

export const notifyJobLimitWarning = async (
  companyId: string,
  planName: string,
  current: number,
  limit: number,
): Promise<void> => {
  try {
    const remaining = Math.max(0, limit - current);
    await notificationService.sendToUser({
      userId: companyId,
      type: NotificationType.JOB_LIMIT_WARNING,
      title: "Job limit nearing",
      body: `You have ${current} of ${limit} active jobs on your ${planName} plan. ${remaining} remaining.`,
      data: {
        kind: NotificationType.JOB_LIMIT_WARNING,
        plan: planName,
        current: String(current),
        limit: String(limit),
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifyJobLimitWarning failed:",
      (err as Error).message,
    );
  }
};

export const notifyJobLimitReached = async (
  companyId: string,
  planName: string,
  limit: number,
): Promise<void> => {
  try {
    await notificationService.sendToUser({
      userId: companyId,
      type: NotificationType.JOB_LIMIT_REACHED,
      title: "Job limit reached",
      body: `You've reached your ${planName} plan limit of ${limit} active jobs. Upgrade your plan to post more.`,
      data: {
        kind: NotificationType.JOB_LIMIT_REACHED,
        plan: planName,
        limit: String(limit),
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifyJobLimitReached failed:",
      (err as Error).message,
    );
  }
};
