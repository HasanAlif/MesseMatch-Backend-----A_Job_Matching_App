import { Request, Response } from "express";
import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import sendResponse from "../../../shared/sendResponse";
import catchAsync from "../../../shared/catchAsync";
import { notificationService } from "./notification.service";

const registerFcmToken = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const { deviceId, fcmToken, platform, deviceName } = req.body;

    await notificationService.registerFcmToken({
      userId,
      deviceId,
      fcmToken,
      platform,
      deviceName,
    });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FCM token registered successfully",
      data: null,
    });
  },
);

const removeFcmToken = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const { deviceId } = req.body;

    await notificationService.removeFcmToken({ userId, deviceId });

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "FCM token removed successfully",
      data: null,
    });
  },
);

const getMyDevices = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;

    const devices = await notificationService.getUserDevices(userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Devices retrieved successfully",
      data: devices,
    });
  },
);

const getMyNotifications = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await notificationService.getUserNotifications(
      userId,
      page,
      limit,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notifications retrieved successfully",
      meta: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
      data: result.notifications,
    });
  },
);

const markAsRead = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;
    const { id: notificationId } = req.params;

    const result = await notificationService.markAsRead(userId, notificationId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Notification marked as read",
      data: result,
    });
  },
);

const markAllAsRead = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;

    const count = await notificationService.markAllAsRead(userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: `${count} notifications marked as read`,
      data: { count },
    });
  },
);

const getUnreadCount = catchAsync(
  async (req: Request & { user?: JwtPayload }, res: Response) => {
    const userId = req.user?.id as string;

    const count = await notificationService.getUnreadCount(userId);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Unread count retrieved",
      data: { unreadCount: count },
    });
  },
);

const sendToUser = catchAsync(async (req: Request, res: Response) => {
  const { userId, title, body, data, type } = req.body;

  const result = await notificationService.sendToUser({
    userId,
    title,
    body,
    data,
    type,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification sent",
    data: result,
  });
});

const sendToMultipleUsers = catchAsync(async (req: Request, res: Response) => {
  const { userIds, title, body, data, type } = req.body;

  const result = await notificationService.sendToMultipleUsers({
    userIds,
    title,
    body,
    data,
    type,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Sent: ${result.successCount}, Failed: ${result.failureCount}`,
    data: result,
  });
});

export const notificationController = {
  registerFcmToken,
  removeFcmToken,
  getMyDevices,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  sendToUser,
  sendToMultipleUsers,
};
