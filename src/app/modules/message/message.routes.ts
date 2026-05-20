import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { messageController } from "./message.controller";
import { messageValidation } from "./message.validation";
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

export const messageRoutes = router;
