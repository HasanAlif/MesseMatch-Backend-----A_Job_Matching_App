import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { messageController } from "./message.controller";
import { messageValidation } from "./message.validation";
import { fileUploader } from "../../../helpars/fileUploader";
import { UserRole } from "../../models/User.model";

const router = express.Router();

// Only FITTER and COMPANY can use chat
const chatRoles = [UserRole.FITTER, UserRole.COMPANY];

// Get users in sidebar (with conversation history)
router.get("/users", auth(...chatRoles), messageController.getUsersForSidebar);

// Get unread message count
router.get(
  "/unread-count",
  auth(...chatRoles),
  messageController.getUnreadMessageCount,
);

// Get messages with a specific user
router.get(
  "/:id",
  auth(...chatRoles),
  validateRequest(messageValidation.getMessagesSchema),
  messageController.getMessages,
);

// Send message to a user (supports up to 5 images)
router.post(
  "/:id",
  auth(...chatRoles),
  fileUploader.upload.array("images", 5),
  validateRequest(messageValidation.sendMessageSchema),
  messageController.sendMessage,
);

// Mark messages as read
router.patch("/:id/read", auth(...chatRoles), messageController.markAsRead);

export const messageRoutes = router;
