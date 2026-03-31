import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { notificationController } from "./notification.controller";
import { notificationValidation } from "./notification.validation";
import { UserRole } from "../../models";

const router = express.Router();

const roles = [UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY];

// User endpoints - any authenticated user
router.post(
  "/fcm-token",
  auth(...roles),
  validateRequest(notificationValidation.registerFcmTokenSchema),
  notificationController.registerFcmToken,
);

router.post(
  "/fcm-token/remove",
  auth(...roles),
  validateRequest(notificationValidation.removeFcmTokenSchema),
  notificationController.removeFcmToken,
);

router.get("/my-devices", auth(...roles), notificationController.getMyDevices);

router.get(
  "/my-notifications",
  auth(...roles),
  notificationController.getMyNotifications,
);

router.get(
  "/unread-count",
  auth(...roles),
  notificationController.getUnreadCount,
);

router.patch(
  "/mark-all-read",
  auth(...roles),
  notificationController.markAllAsRead,
);

router.patch("/:id/read", auth(...roles), notificationController.markAsRead);

// Admin-only endpoints
router.post(
  "/send",
  auth(UserRole.ADMIN),
  validateRequest(notificationValidation.sendToUserSchema),
  notificationController.sendToUser,
);

router.post(
  "/send-batch",
  auth(UserRole.ADMIN),
  validateRequest(notificationValidation.sendToMultipleSchema),
  notificationController.sendToMultipleUsers,
);

export const notificationRoutes = router;
