import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { notificationController } from "./notification.controller";
import { notificationValidation } from "./notification.validation";
import { UserRole } from "../../models";

const router = express.Router();

// User endpoints - any authenticated user
router.post(
  "/fcm-token",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  validateRequest(notificationValidation.registerFcmTokenSchema),
  notificationController.registerFcmToken,
);

router.post(
  "/fcm-token/remove",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  validateRequest(notificationValidation.removeFcmTokenSchema),
  notificationController.removeFcmToken,
);

router.get(
  "/my-devices",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  notificationController.getMyDevices,
);

router.get(
  "/my-notifications",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  notificationController.getMyNotifications,
);

router.get(
  "/unread-count",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  notificationController.getUnreadCount,
);

router.patch(
  "/mark-all-read",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  notificationController.markAllAsRead,
);

router.patch(
  "/:id/read",
  auth(UserRole.ADMIN, UserRole.FITTER, UserRole.COMPANY),
  notificationController.markAsRead,
);

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
