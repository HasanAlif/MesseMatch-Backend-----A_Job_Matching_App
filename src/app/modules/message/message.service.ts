import httpStatus from "http-status";
import { Message } from "../../models/Message.model";
import { User, UserRole, UserStatus } from "../../models/User.model";
import { cloudinary } from "../../../helpars/fileUploader";
import ApiError from "../../../errors/ApiErrors";
import {
  ALLOWED_CHAT_PAIRS,
  MESSAGE_ERRORS,
  MESSAGE_CONFIG,
} from "./message.constants";

// Validate chat permission between two roles
const validateChatPermission = (
  senderRole: string,
  receiverRole: string,
): void => {
  if (senderRole === UserRole.ADMIN) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      MESSAGE_ERRORS.ROLE_RESTRICTION_ADMIN_SENDER,
    );
  }

  if (receiverRole === UserRole.ADMIN) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      MESSAGE_ERRORS.ROLE_RESTRICTION_ADMIN_RECEIVER,
    );
  }

  const allowedRoles = ALLOWED_CHAT_PAIRS[senderRole];
  if (!allowedRoles || !allowedRoles.includes(receiverRole)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      MESSAGE_ERRORS.ROLE_RESTRICTION_SAME(senderRole),
    );
  }
};

// Check if two users can communicate
const canUsersCommunicate = (role1: string, role2: string): boolean => {
  if (role1 === UserRole.ADMIN || role2 === UserRole.ADMIN) {
    return false;
  }
  const allowed = ALLOWED_CHAT_PAIRS[role1];
  return allowed?.includes(role2) ?? false;
};

// Socket instance holders
let ioInstance: any = null;
const onlineUsers = new Map<string, string>();

export const setIO = (io: any) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;

export const getReceiverSocketId = (userId: string): string | undefined => {
  return onlineUsers.get(userId);
};

export const setUserOnline = (userId: string, socketId: string) => {
  onlineUsers.set(userId, socketId);
};

export const setUserOffline = (userId: string) => {
  onlineUsers.delete(userId);
};

export const getOnlineUserIds = (): string[] => {
  return Array.from(onlineUsers.keys());
};

// Get users for sidebar (users with conversation history)
const getUsersForSidebar = async (loggedInUserId: string) => {
  const currentUser = await User.findById(loggedInUserId).select("role");
  if (!currentUser) {
    throw new ApiError(httpStatus.NOT_FOUND, MESSAGE_ERRORS.USER_NOT_FOUND);
  }

  const allowedRoles = ALLOWED_CHAT_PAIRS[currentUser.role] || [];
  if (allowedRoles.length === 0) {
    return [];
  }

  const messages = await Message.find({
    $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
  }).select("senderId receiverId");

  const userIds = new Set<string>();
  messages.forEach((message) => {
    const senderId = message.senderId.toString();
    const receiverId = message.receiverId.toString();
    if (senderId !== loggedInUserId) {
      userIds.add(senderId);
    }
    if (receiverId !== loggedInUserId) {
      userIds.add(receiverId);
    }
  });

  const userIdsArray = Array.from(userIds);
  if (userIdsArray.length === 0) {
    return [];
  }

  // Filter by allowed roles
  const filteredUsers = await User.find({
    _id: { $in: userIdsArray },
    role: { $in: allowedRoles },
    status: UserStatus.ACTIVE,
  }).select(
    "_id userName fullName email role profilePicture isOnline lastSeen",
  );

  // Get unread message count for each user
  const usersWithUnreadCount = await Promise.all(
    filteredUsers.map(async (user) => {
      const unreadCount = await Message.countDocuments({
        senderId: user._id,
        receiverId: loggedInUserId,
        isSeen: false,
      });

      return {
        _id: user._id,
        userName: user.userName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        unreadCount,
      };
    }),
  );

  return usersWithUnreadCount;
};

// Get messages between two users with pagination
const getMessages = async (
  myId: string,
  userToChatId: string,
  options: { page?: number; limit?: number } = {},
) => {
  const { page = 1, limit = MESSAGE_CONFIG.DEFAULT_PAGE_SIZE } = options;

  // Validate both users exist and get their roles
  const [currentUser, otherUser] = await Promise.all([
    User.findById(myId).select("role"),
    User.findById(userToChatId).select("role status"),
  ]);

  if (!currentUser) {
    throw new ApiError(httpStatus.NOT_FOUND, MESSAGE_ERRORS.USER_NOT_FOUND);
  }

  if (!otherUser) {
    throw new ApiError(httpStatus.NOT_FOUND, MESSAGE_ERRORS.RECEIVER_NOT_FOUND);
  }

  // Validate role-based permission
  if (!canUsersCommunicate(currentUser.role, otherUser.role)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      MESSAGE_ERRORS.UNAUTHORIZED_CONVERSATION,
    );
  }

  const skip = (page - 1) * limit;

  const [messages, totalCount] = await Promise.all([
    Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Message.countDocuments({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }),
  ]);

  // Mark messages from other user as seen
  await Message.updateMany(
    {
      senderId: userToChatId,
      receiverId: myId,
      isSeen: false,
    },
    {
      $set: { isSeen: true, seenAt: new Date() },
    },
  );

  // Emit read status to sender if online (using room emission for multi-device support)
  if (ioInstance) {
    ioInstance
      .to(userToChatId.toString())
      .emit("messages_read", { userId: myId });
  }

  return {
    messages: messages.reverse(),
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

// Send message with image upload support
const sendMessage = async (
  senderId: string,
  receiverId: string,
  data: {
    text?: string;
    image?: string | string[];
    files?: Express.Multer.File[];
  },
) => {
  const { text, image, files } = data;

  // Prevent self-messaging
  if (senderId === receiverId) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.SELF_MESSAGE);
  }

  // Fetch both users with their roles
  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("_id role status"),
    User.findById(receiverId).select("_id role status"),
  ]);

  if (!sender) {
    throw new ApiError(httpStatus.NOT_FOUND, MESSAGE_ERRORS.USER_NOT_FOUND);
  }

  if (!receiver) {
    throw new ApiError(httpStatus.NOT_FOUND, MESSAGE_ERRORS.RECEIVER_NOT_FOUND);
  }

  if (receiver.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.INACTIVE_USER);
  }

  // Validate role-based chat permission
  validateChatPermission(sender.role, receiver.role);

  // Validate that at least text or images are provided
  if (
    (!text || text.trim() === "") &&
    !image &&
    (!files || files.length === 0)
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.EMPTY_MESSAGE);
  }

  const messageText = text?.trim() || "";

  // Validate text length
  if (messageText.length > MESSAGE_CONFIG.MAX_TEXT_LENGTH) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Message text cannot exceed ${MESSAGE_CONFIG.MAX_TEXT_LENGTH} characters`,
    );
  }

  // Handle image upload
  let imageUrls: string[] = [];

  // Handle file uploads from form-data (REST API)
  if (files && files.length > 0) {
    if (files.length > MESSAGE_CONFIG.MAX_IMAGES) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot send more than ${MESSAGE_CONFIG.MAX_IMAGES} images`,
      );
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const uploadResponse = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
          {
            folder: "message_images",
            resource_type: "auto",
            transformation: [
              { width: 1000, height: 1000, crop: "limit" },
              { quality: "auto:good" },
              { format: "auto" },
            ],
          },
        );
        imageUrls.push(uploadResponse.secure_url);
      } catch (cloudinaryError: any) {
        throw new ApiError(
          httpStatus.INTERNAL_SERVER_ERROR,
          `${MESSAGE_ERRORS.UPLOAD_FAILED} ${i + 1}: ${cloudinaryError.message}`,
        );
      }
    }
  }
  // Handle base64 strings or URLs (Socket.IO)
  else if (image) {
    const imagesToProcess = Array.isArray(image) ? image : [image];

    if (imagesToProcess.length > MESSAGE_CONFIG.MAX_IMAGES) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot send more than ${MESSAGE_CONFIG.MAX_IMAGES} images`,
      );
    }

    for (let i = 0; i < imagesToProcess.length; i++) {
      const currentImage = imagesToProcess[i];

      if (typeof currentImage !== "string" || currentImage.trim() === "") {
        continue;
      }

      // Check size limit for base64
      if (
        !currentImage.startsWith("http") &&
        currentImage.length > MESSAGE_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Image ${i + 1} too large. Maximum size is ${MESSAGE_CONFIG.MAX_IMAGE_SIZE_MB}MB`,
        );
      }

      if (currentImage.startsWith("http")) {
        imageUrls.push(currentImage);
      } else {
        try {
          const uploadResponse = await cloudinary.uploader.upload(
            currentImage,
            {
              folder: "message_images",
              resource_type: "auto",
              transformation: [
                { width: 1000, height: 1000, crop: "limit" },
                { quality: "auto:good" },
                { format: "auto" },
              ],
            },
          );
          imageUrls.push(uploadResponse.secure_url);
        } catch (cloudinaryError: any) {
          throw new ApiError(
            httpStatus.INTERNAL_SERVER_ERROR,
            `${MESSAGE_ERRORS.UPLOAD_FAILED} ${i + 1}: ${cloudinaryError.message}`,
          );
        }
      }
    }
  }

  const newMessage = new Message({
    senderId,
    receiverId,
    text: messageText,
    image: imageUrls,
  });

  await newMessage.save();

  // Convert to plain object to avoid Socket.io Mongoose document serialization issues
  const messageData = newMessage.toObject();

  // Emit to receiver via socket if online
  if (ioInstance) {
    // 1. We check if they are in onlineUsers for our own tracking (optional)
    const isOnline = onlineUsers.has(receiverId.toString());

    if (isOnline) {
      // 2. Best practice: emit to the room name (userId) so ALL of the user's connected devices get it
      ioInstance.to(receiverId.toString()).emit("receive_message", messageData);
    }
  }

  return messageData; // Return the plain object, not the Mongoose document
};

// Get count of users with unread messages
const getUnreadMessageCount = async (userId: string) => {
  const unreadSenders = await Message.find({
    receiverId: userId,
    isSeen: false,
  }).distinct("senderId");

  return { unreadCount: unreadSenders.length };
};

// Mark messages as read
const markMessagesAsRead = async (userId: string, senderId: string) => {
  await Message.updateMany(
    {
      senderId: senderId,
      receiverId: userId,
      isSeen: false,
    },
    {
      $set: { isSeen: true, seenAt: new Date() },
    },
  );

  // Notify sender that messages were read (room emission)
  if (ioInstance) {
    ioInstance.to(senderId.toString()).emit("messages_read", { userId });
  }
};

export const messageService = {
  getUsersForSidebar,
  getMessages,
  sendMessage,
  getUnreadMessageCount,
  markMessagesAsRead,
  validateChatPermission,
  canUsersCommunicate,
};
