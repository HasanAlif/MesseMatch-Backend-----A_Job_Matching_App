import { NotificationType } from "../notification/notification.model";
import { notificationService } from "../notification/notification.service";
import { hasNotificationOfTypeSince } from "../notification/notification.daily.helpers";

export const notifySwipeThreshold = async (
  fitterId: string,
  currentCount: number,
  limit: number,
  swipeResetAt: Date | undefined,
): Promise<void> => {
  try {
    const since = swipeResetAt ?? new Date(0);
    const alreadySent = await hasNotificationOfTypeSince(
      fitterId,
      NotificationType.SWIPE_THRESHOLD,
      since,
    );
    if (alreadySent) return;

    await notificationService.sendToUser({
      userId: fitterId,
      type: NotificationType.SWIPE_THRESHOLD,
      title: "Swipe limit warning",
      body: `You've used ${currentCount} of ${limit} swipes this month. Upgrade your plan to get unlimited swipes.`,
      data: {
        kind: NotificationType.SWIPE_THRESHOLD,
        currentCount: String(currentCount),
        limit: String(limit),
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifySwipeThreshold failed:",
      (err as Error).message,
    );
  }
};

export const notifySwipeLimitReached = async (
  fitterId: string,
  limit: number,
  swipeResetAt: Date | undefined,
): Promise<void> => {
  try {
    const since = swipeResetAt ?? new Date(0);
    const alreadySent = await hasNotificationOfTypeSince(
      fitterId,
      NotificationType.SWIPE_LIMIT_REACHED,
      since,
    );
    if (alreadySent) return;

    await notificationService.sendToUser({
      userId: fitterId,
      type: NotificationType.SWIPE_LIMIT_REACHED,
      title: "Swipe limit reached",
      body: `Swipe limit over. Please upgrade your plan to get unlimited swipes.`,
      data: {
        kind: NotificationType.SWIPE_LIMIT_REACHED,
        limit: String(limit),
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifySwipeLimitReached failed:",
      (err as Error).message,
    );
  }
};
