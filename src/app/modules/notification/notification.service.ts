import mongoose from "mongoose";
import httpStatus from "http-status";
import { MulticastMessage } from "firebase-admin/messaging";
import {
  Notification,
  NotificationStatus,
  NotificationType,
  INotification,
} from "./notification.model";
import {
  User,
  FCM_TOKEN_CONFIG,
  DevicePlatform,
  IFcmTokenEntry,
} from "../../models";
import ApiError from "../../../errors/ApiErrors";
import { getMessaging, isFirebaseInitialized } from "../../../shared/firebase";

interface RegisterFcmTokenPayload {
  userId: string;
  deviceId: string;
  fcmToken: string;
  platform: DevicePlatform;
  deviceName?: string;
}

interface RemoveFcmTokenPayload {
  userId: string;
  deviceId: string;
}

interface SendNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  type: NotificationType;
}

interface SendToUserPayload extends SendNotificationPayload {
  userId: string;
}

export interface PreloadedNotificationUser {
  _id: mongoose.Types.ObjectId | string;
  fcmTokens?: IFcmTokenEntry[];
}

const PERMANENT_TOKEN_ERRORS = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

const registerFcmToken = async (
  payload: RegisterFcmTokenPayload,
): Promise<void> => {
  const { userId, deviceId, fcmToken, platform, deviceName } = payload;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  if (!deviceId || deviceId.trim().length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Device ID is required");
  }

  if (!fcmToken || fcmToken.trim().length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "FCM token is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const now = new Date();
  const trimmedDeviceId = deviceId.trim();
  const trimmedToken = fcmToken.trim();

  const existingTokenIndex =
    user.fcmTokens?.findIndex((t) => t.deviceId === trimmedDeviceId) ?? -1;

  if (existingTokenIndex >= 0) {
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`fcmTokens.${existingTokenIndex}.token`]: trimmedToken,
        [`fcmTokens.${existingTokenIndex}.platform`]: platform,
        [`fcmTokens.${existingTokenIndex}.deviceName`]: deviceName,
        [`fcmTokens.${existingTokenIndex}.lastActiveAt`]: now,
      },
    });
  } else {
    const currentTokenCount = user.fcmTokens?.length ?? 0;

    if (currentTokenCount >= FCM_TOKEN_CONFIG.MAX_DEVICES_PER_USER) {
      const oldestDevice = user.fcmTokens?.sort(
        (a, b) =>
          new Date(a.lastActiveAt).getTime() -
          new Date(b.lastActiveAt).getTime(),
      )[0];

      if (oldestDevice) {
        await User.findByIdAndUpdate(userId, {
          $pull: { fcmTokens: { deviceId: oldestDevice.deviceId } },
        });
      }
    }

    await User.findByIdAndUpdate(userId, {
      $push: {
        fcmTokens: {
          deviceId: trimmedDeviceId,
          token: trimmedToken,
          platform,
          deviceName,
          lastActiveAt: now,
          createdAt: now,
        },
      },
    });
  }
};

const removeFcmToken = async (
  payload: RemoveFcmTokenPayload,
): Promise<void> => {
  const { userId, deviceId } = payload;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  if (!deviceId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Device ID is required");
  }

  await User.findByIdAndUpdate(userId, {
    $pull: { fcmTokens: { deviceId: deviceId.trim() } },
  });
};

const getActiveTokens = (
  fcmTokens: Array<{ token: string; lastActiveAt: Date }> | undefined,
): string[] => {
  if (!fcmTokens || fcmTokens.length === 0) return [];

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - FCM_TOKEN_CONFIG.STALE_TOKEN_DAYS);

  return fcmTokens
    .filter((t) => new Date(t.lastActiveAt) > staleDate)
    .map((t) => t.token);
};

const markNotificationStatus = async (
  notificationId: mongoose.Types.ObjectId | string,
  patch: Record<string, unknown>,
): Promise<INotification | null> => {
  return Notification.findByIdAndUpdate(notificationId, patch, {
    new: true,
  });
};

const deliverNotification = async (
  user: PreloadedNotificationUser,
  notification: INotification,
  payload: SendToUserPayload,
): Promise<INotification> => {
  const { title, body, data } = payload;
  const userIdStr = user._id.toString();
  const activeTokens = getActiveTokens(user.fcmTokens);

  if (activeTokens.length === 0) {
    const updated = await markNotificationStatus(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "No active FCM tokens registered",
    });
    return updated ?? notification;
  }

  try {
    const messaging = getMessaging();

    const multicastMessage: MulticastMessage = {
      tokens: activeTokens,
      notification: { title, body },
      data: data
        ? { ...data, notificationId: notification._id.toString() }
        : { notificationId: notification._id.toString() },
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "default" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
      },
    };

    const response = await messaging.sendEachForMulticast(multicastMessage);

    const invalidTokens: string[] = [];
    response.responses.forEach((resp, index) => {
      if (!resp.success) {
        const errorCode = resp.error?.code;
        if (errorCode && PERMANENT_TOKEN_ERRORS.includes(errorCode)) {
          invalidTokens.push(activeTokens[index]);
        }
      }
    });

    if (invalidTokens.length > 0) {
      User.updateOne(
        { _id: user._id },
        { $pull: { fcmTokens: { token: { $in: invalidTokens } } } },
      ).catch((err) =>
        console.error(
          `[notify] Failed to prune invalid tokens for user ${userIdStr}:`,
          (err as Error).message,
        ),
      );
    }

    const finalPatch =
      response.successCount > 0
        ? {
            status: NotificationStatus.SENT,
            fcmMessageId: `sent_to_${response.successCount}_devices`,
          }
        : {
            status: NotificationStatus.FAILED,
            errorMessage: `All ${response.failureCount} devices failed`,
          };

    const updated = await markNotificationStatus(notification._id, finalPatch);
    return updated ?? notification;
  } catch (error: unknown) {
    const err = error as { message?: string };
    const errorMessage = (err?.message || "Unknown error").substring(0, 500);

    const updated = await markNotificationStatus(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage,
    });

    console.error(`FCM send error for user ${userIdStr}:`, errorMessage);
    return updated ?? notification;
  }
};

const createPendingNotification = async (
  userId: string,
  payload: SendToUserPayload,
): Promise<INotification> => {
  const { title, body, data, type } = payload;
  return Notification.create({
    userId: new mongoose.Types.ObjectId(userId),
    title,
    body,
    data,
    type,
    status: NotificationStatus.PENDING,
    isRead: false,
  });
};

const sendToUser = async (
  payload: SendToUserPayload,
): Promise<INotification> => {
  const { userId } = payload;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const notification = await createPendingNotification(userId, payload);

  if (!isFirebaseInitialized()) {
    const updated = await markNotificationStatus(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "Firebase not initialized",
    });
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Push notification service unavailable",
    );
  }

  const user = await User.findById(userId)
    .select("_id fcmTokens")
    .lean<PreloadedNotificationUser>();
  if (!user) {
    await markNotificationStatus(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "User not found",
    });
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return deliverNotification(user, notification, payload);
};

const sendToUserWithDocument = async (
  user: PreloadedNotificationUser,
  payload: SendToUserPayload,
): Promise<INotification> => {
  const userId = user._id.toString();
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const notification = await createPendingNotification(userId, {
    ...payload,
    userId,
  });

  if (!isFirebaseInitialized()) {
    await markNotificationStatus(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "Firebase not initialized",
    });
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Push notification service unavailable",
    );
  }

  return deliverNotification(user, notification, { ...payload, userId });
};

const getUserNotifications = async (
  userId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{
  notifications: INotification[];
  total: number;
  page: number;
  totalPages: number;
}> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const skip = (page - 1) * limit;
  const userIdObj = new mongoose.Types.ObjectId(userId);

  const [notifications, total] = await Promise.all([
    Notification.find({ userId: userIdObj })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ userId: userIdObj }),
  ]);

  // Mark all unread notifications as read
  const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);

  if (unreadIds.length > 0) {
    await Notification.updateMany(
      { _id: { $in: unreadIds } },
      { isRead: true, readAt: new Date() },
    );
  }

  // Return updated notifications
  const updatedNotifications = notifications.map((n) => ({
    ...n,
    isRead: true,
    readAt: unreadIds.includes(n._id as any) ? new Date() : n.readAt,
  }));

  return {
    notifications: updatedNotifications as INotification[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

const getUnreadCount = async (userId: string): Promise<number> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  return Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    isRead: false,
  });
};

const getUserDevices = async (
  userId: string,
): Promise<
  Array<{
    deviceId: string;
    platform: string;
    deviceName?: string;
    lastActiveAt: Date;
    createdAt: Date;
  }>
> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return (user.fcmTokens ?? []).map((t) => ({
    deviceId: t.deviceId,
    platform: t.platform,
    deviceName: t.deviceName,
    lastActiveAt: t.lastActiveAt,
    createdAt: t.createdAt,
  }));
};

export const notificationService = {
  registerFcmToken,
  removeFcmToken,
  sendToUser,
  sendToUserWithDocument,
  getUserNotifications,
  getUnreadCount,
  getUserDevices,
};
