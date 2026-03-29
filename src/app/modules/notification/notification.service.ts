import mongoose from "mongoose";
import httpStatus from "http-status";
import { MulticastMessage } from "firebase-admin/messaging";
import {
  Notification,
  NotificationStatus,
  NotificationType,
  INotification,
} from "./notification.model";
import { User, FCM_TOKEN_CONFIG, DevicePlatform } from "../../models";
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
  type?: NotificationType;
}

interface SendToUserPayload extends SendNotificationPayload {
  userId: string;
}

interface SendToMultiplePayload extends SendNotificationPayload {
  userIds: string[];
}

interface BatchResult {
  successCount: number;
  failureCount: number;
  results: Array<{
    userId: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
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

const sendToUser = async (
  payload: SendToUserPayload,
): Promise<INotification> => {
  const { userId, title, body, data, type = NotificationType.SYSTEM } = payload;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const notification = await Notification.create({
    userId: new mongoose.Types.ObjectId(userId),
    title,
    body,
    data,
    type,
    status: NotificationStatus.PENDING,
  });

  if (!isFirebaseInitialized()) {
    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "Firebase not initialized",
    });
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Push notification service unavailable",
    );
  }

  const user = await User.findById(userId).lean();
  if (!user) {
    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "User not found",
    });
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const activeTokens = getActiveTokens(user.fcmTokens);

  if (activeTokens.length === 0) {
    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: "No active FCM tokens registered",
    });
    return notification;
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
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: { $in: invalidTokens } } },
      });
    }

    if (response.successCount > 0) {
      await Notification.findByIdAndUpdate(notification._id, {
        status: NotificationStatus.SENT,
        fcmMessageId: `sent_to_${response.successCount}_devices`,
      });
    } else {
      await Notification.findByIdAndUpdate(notification._id, {
        status: NotificationStatus.FAILED,
        errorMessage: `All ${response.failureCount} devices failed`,
      });
    }

    return (await Notification.findById(notification._id)) as INotification;
  } catch (error: unknown) {
    const err = error as { message?: string };
    const errorMessage = err?.message || "Unknown error";

    await Notification.findByIdAndUpdate(notification._id, {
      status: NotificationStatus.FAILED,
      errorMessage: errorMessage.substring(0, 500),
    });

    console.error(`FCM send error for user ${userId}:`, errorMessage);
    return (await Notification.findById(notification._id)) as INotification;
  }
};

const sendToMultipleUsers = async (
  payload: SendToMultiplePayload,
): Promise<BatchResult> => {
  const {
    userIds,
    title,
    body,
    data,
    type = NotificationType.SYSTEM,
  } = payload;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User IDs array is required");
  }

  if (userIds.length > 500) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot send to more than 500 users at once",
    );
  }

  const validUserIds = userIds.filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );
  if (validUserIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No valid user IDs provided");
  }

  const users = await User.find({
    _id: { $in: validUserIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean();

  const tokenToUserId = new Map<string, string>();
  const usersWithActiveTokens: string[] = [];
  const usersWithoutTokens: string[] = [];

  users.forEach((user) => {
    const activeTokens = getActiveTokens(user.fcmTokens);
    if (activeTokens.length > 0) {
      usersWithActiveTokens.push(user._id.toString());
      activeTokens.forEach((token) => {
        tokenToUserId.set(token, user._id.toString());
      });
    } else {
      usersWithoutTokens.push(user._id.toString());
    }
  });

  const notificationDocs = validUserIds.map((userId) => ({
    userId: new mongoose.Types.ObjectId(userId),
    title,
    body,
    data,
    type,
    status: usersWithActiveTokens.includes(userId)
      ? NotificationStatus.PENDING
      : NotificationStatus.FAILED,
    errorMessage: !usersWithActiveTokens.includes(userId)
      ? "No active FCM tokens registered"
      : undefined,
  }));

  const notifications = await Notification.insertMany(notificationDocs);
  const results: BatchResult["results"] = [];

  usersWithoutTokens.forEach((userId) => {
    results.push({
      userId,
      success: false,
      error: "No active FCM tokens registered",
    });
  });

  if (tokenToUserId.size === 0 || !isFirebaseInitialized()) {
    return {
      successCount: 0,
      failureCount: validUserIds.length,
      results,
    };
  }

  const allTokens = Array.from(tokenToUserId.keys());
  const userSuccessMap = new Map<string, boolean>();
  usersWithActiveTokens.forEach((userId) => userSuccessMap.set(userId, false));

  const invalidTokens: string[] = [];

  for (let i = 0; i < allTokens.length; i += 500) {
    const batchTokens = allTokens.slice(i, i + 500);

    const multicastMessage: MulticastMessage = {
      tokens: batchTokens,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "default" },
      },
      apns: {
        payload: { aps: { sound: "default" } },
      },
    };

    try {
      const messaging = getMessaging();
      const response = await messaging.sendEachForMulticast(multicastMessage);

      response.responses.forEach((resp, index) => {
        const token = batchTokens[index];
        const userId = tokenToUserId.get(token);

        if (!userId) return;

        if (resp.success) {
          userSuccessMap.set(userId, true);
        } else {
          const errorCode = resp.error?.code;
          if (errorCode && PERMANENT_TOKEN_ERRORS.includes(errorCode)) {
            invalidTokens.push(token);
          }
        }
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Multicast batch error:", err?.message);
    }
  }

  let successCount = 0;
  let failureCount = usersWithoutTokens.length;

  usersWithActiveTokens.forEach((userId) => {
    const succeeded = userSuccessMap.get(userId) ?? false;
    const notification = notifications.find(
      (n) => n.userId.toString() === userId,
    );

    if (succeeded) {
      successCount++;
      results.push({ userId, success: true });
      if (notification) {
        Notification.findByIdAndUpdate(notification._id, {
          status: NotificationStatus.SENT,
        }).exec();
      }
    } else {
      failureCount++;
      results.push({ userId, success: false, error: "All devices failed" });
      if (notification) {
        Notification.findByIdAndUpdate(notification._id, {
          status: NotificationStatus.FAILED,
          errorMessage: "All devices failed",
        }).exec();
      }
    }
  });

  if (invalidTokens.length > 0) {
    User.updateMany(
      { "fcmTokens.token": { $in: invalidTokens } },
      { $pull: { fcmTokens: { token: { $in: invalidTokens } } } },
    ).exec();
  }

  return { successCount, failureCount, results };
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

  const [notifications, total] = await Promise.all([
    Notification.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
    }),
  ]);

  return {
    notifications: notifications as INotification[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};

const markAsRead = async (
  userId: string,
  notificationId: string,
): Promise<INotification> => {
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(notificationId)
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid ID");
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(notificationId),
      userId: new mongoose.Types.ObjectId(userId),
    },
    { status: NotificationStatus.READ, readAt: new Date() },
    { new: true },
  );

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  return notification;
};

const markAllAsRead = async (userId: string): Promise<number> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  const result = await Notification.updateMany(
    {
      userId: new mongoose.Types.ObjectId(userId),
      status: { $ne: NotificationStatus.READ },
    },
    { status: NotificationStatus.READ, readAt: new Date() },
  );

  return result.modifiedCount;
};

const getUnreadCount = async (userId: string): Promise<number> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  return Notification.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    status: { $in: [NotificationStatus.SENT, NotificationStatus.PENDING] },
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
  sendToMultipleUsers,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getUserDevices,
};
