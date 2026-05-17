import { notificationService } from "../notification/notification.service";
import { NotificationType } from "../notification/notification.model";

export const notifyJobRequestAccepted = async (
  fitterId: string,
  jobTitle: string,
  companyName: string,
  jobId: string,
  requestId: string,
): Promise<void> => {
  try {
    await notificationService.sendToUser({
      userId: fitterId,
      type: NotificationType.JOB_REQUEST_ACCEPTED,
      title: "Application accepted 🎉",
      body: `${companyName} accepted your application for "${jobTitle}". Get ready to start!`,
      data: {
        kind: NotificationType.JOB_REQUEST_ACCEPTED,
        jobId,
        requestId,
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifyJobRequestAccepted failed:",
      (err as Error).message,
    );
  }
};

export const notifyRatingReceived = async (
  fitterId: string,
  rating: number,
  companyName: string,
  jobTitle: string,
  jobId: string,
  requestId: string,
): Promise<void> => {
  try {
    const stars = "★".repeat(Math.max(0, Math.min(5, Math.round(rating))));
    await notificationService.sendToUser({
      userId: fitterId,
      type: NotificationType.JOB_RATING_RECEIVED,
      title: "You got a new rating",
      body: `${companyName} rated you ${rating} ${stars} for "${jobTitle}".`,
      data: {
        kind: NotificationType.JOB_RATING_RECEIVED,
        jobId,
        requestId,
        rating: String(rating),
      },
    });
  } catch (err) {
    console.error(
      "[notify] notifyRatingReceived failed:",
      (err as Error).message,
    );
  }
};
