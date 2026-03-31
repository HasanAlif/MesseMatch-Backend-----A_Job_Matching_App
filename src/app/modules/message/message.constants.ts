import { UserRole } from "../../models/User.model";

// Role-based chat permissions
export const ALLOWED_CHAT_PAIRS: Record<string, string[]> = {
  [UserRole.FITTER]: [UserRole.COMPANY, UserRole.FITTER],
  [UserRole.COMPANY]: [UserRole.FITTER, UserRole.COMPANY],
  [UserRole.ADMIN]: [],
};

export const MESSAGE_ERRORS = {
  ROLE_RESTRICTION_ADMIN_SENDER: "Administrators cannot participate in chat",
  ROLE_RESTRICTION_ADMIN_RECEIVER: "Cannot send messages to administrators",
  ROLE_RESTRICTION_SAME: (role: string) =>
    `${role} users can only chat with ${ALLOWED_CHAT_PAIRS[role]?.join(" or ") || "authorized users"}`,
  USER_NOT_FOUND: "User not found",
  RECEIVER_NOT_FOUND: "Receiver not found",
  INACTIVE_USER: "Cannot message inactive user",
  EMPTY_MESSAGE: "Message must contain either text or images",
  SELF_MESSAGE: "Cannot send message to yourself",
  UPLOAD_FAILED: "Failed to upload image",
  UNAUTHORIZED_CONVERSATION: "You are not authorized to view this conversation",
};

export const MESSAGE_SUCCESS = {
  SENT: "Message sent successfully",
  RETRIEVED: "Messages retrieved successfully",
  MARKED_READ: "Messages marked as read",
  USERS_RETRIEVED: "Users retrieved successfully",
  UNREAD_COUNT: "Unread message count retrieved successfully",
};

export const MESSAGE_CONFIG = {
  MAX_TEXT_LENGTH: 5000,
  MAX_IMAGES: 5,
  MAX_IMAGE_SIZE_MB: 10,
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
};
