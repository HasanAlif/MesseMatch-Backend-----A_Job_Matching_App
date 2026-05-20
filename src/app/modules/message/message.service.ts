import httpStatus from "http-status";
import { Types } from "mongoose";
import { Message } from "../../models/Message.model";
import { User, UserRole, UserStatus } from "../../models/User.model";
import { cloudinary } from "../../../helpars/fileUploader";
import ApiError from "../../../errors/ApiErrors";
import streamifier from "streamifier";
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
// Tracks every active socket per user so multi-device sessions stay correct.
const onlineUsers = new Map<string, Set<string>>();
const socketMessageIdempotencyCache = new Map<
  string,
  { expiresAt: number; message: any }
>();

interface SocketFileInput {
  fileName?: string;
  mimeType?: string;
  size?: number;
  data?: unknown;
  buffer?: unknown;
}

interface NormalizedSocketFile {
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export const setIO = (io: any) => {
  ioInstance = io;
};

export const getIO = () => ioInstance;

export const getReceiverSocketId = (userId: string): string | undefined => {
  const sockets = onlineUsers.get(userId);
  return sockets ? sockets.values().next().value : undefined;
};

export const getReceiverSocketIds = (userId: string): string[] => {
  const sockets = onlineUsers.get(userId);
  return sockets ? Array.from(sockets) : [];
};

export const setUserOnline = (userId: string, socketId: string) => {
  let sockets = onlineUsers.get(userId);
  if (!sockets) {
    sockets = new Set<string>();
    onlineUsers.set(userId, sockets);
  }
  sockets.add(socketId);
};

/** Returns true when the user has no remaining connected sockets. */
export const setUserOffline = (userId: string, socketId: string): boolean => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
};

export const getOnlineUserIds = (): string[] => {
  return Array.from(onlineUsers.keys());
};

const cleanupIdempotencyCache = () => {
  const now = Date.now();
  for (const [key, value] of socketMessageIdempotencyCache.entries()) {
    if (value.expiresAt <= now) {
      socketMessageIdempotencyCache.delete(key);
    }
  }
};

const normalizeSocketBinary = (input: unknown): Buffer | null => {
  if (!input) {
    return null;
  }

  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }

  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("data:")) {
      const commaIndex = trimmed.indexOf(",");
      if (commaIndex === -1) {
        return null;
      }

      const base64Part = trimmed.slice(commaIndex + 1);
      return Buffer.from(base64Part, "base64");
    }

    return Buffer.from(trimmed, "base64");
  }

  return null;
};

// Validate a buffer + mime against the shared mime / size limits.
const validateBufferUpload = (
  buffer: Buffer | null,
  mimeType: string,
  index: number,
): void => {
  if (!buffer || buffer.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid file data at index ${index}`,
    );
  }
  if (!mimeType) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Missing mimeType for file at index ${index}`,
    );
  }
  if (!MESSAGE_CONFIG.SOCKET_ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Unsupported file type at index ${index}`,
    );
  }
  const maxSizeBytes = MESSAGE_CONFIG.MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (buffer.length > maxSizeBytes) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `File ${index + 1} too large. Maximum size is ${MESSAGE_CONFIG.MAX_IMAGE_SIZE_MB}MB`,
    );
  }
};

const normalizeSocketFiles = (
  rawFiles: SocketFileInput[],
): NormalizedSocketFile[] => {
  return rawFiles.map((file, index) => {
    const binarySource = file.data ?? file.buffer;
    const buffer = normalizeSocketBinary(binarySource);
    const mimeType = (file.mimeType || "").toLowerCase();

    validateBufferUpload(buffer, mimeType, index);

    return {
      fileName: file.fileName || `socket_file_${Date.now()}_${index}`,
      mimeType,
      size: buffer!.length,
      buffer: buffer!,
    };
  });
};

// Parse "data:image/png;base64,XXXX" → { mimeType, buffer }. Returns null if not a data URI.
const parseDataUri = (
  uri: string,
): { mimeType: string; buffer: Buffer } | null => {
  const trimmed = uri.trim();
  if (!trimmed.startsWith("data:")) return null;
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex === -1) return null;
  const header = trimmed.slice(5, commaIndex);
  const semiIndex = header.indexOf(";");
  const mimeType = (
    semiIndex === -1 ? header : header.slice(0, semiIndex)
  ).toLowerCase();
  const buffer = Buffer.from(trimmed.slice(commaIndex + 1), "base64");
  return { mimeType, buffer };
};

const uploadBufferToCloudinary = async (
  file: NormalizedSocketFile,
  index: number,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "message_images",
        resource_type: "image",
        transformation: [
          { width: 1000, height: 1000, crop: "limit" },
          { quality: "auto:good" },
          { format: "auto" },
        ],
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(
            new ApiError(
              httpStatus.INTERNAL_SERVER_ERROR,
              `${MESSAGE_ERRORS.UPLOAD_FAILED} ${index + 1}: ${error?.message || "Unknown upload error"}`,
            ),
          );
          return;
        }

        resolve(result.secure_url);
      },
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const uploadFilesWithConcurrency = async (
  files: NormalizedSocketFile[],
): Promise<string[]> => {
  const concurrency = Math.max(
    1,
    MESSAGE_CONFIG.SOCKET_FILE_UPLOAD_CONCURRENCY,
  );
  const results: string[] = new Array(files.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < files.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await uploadBufferToCloudinary(
        files[currentIndex],
        currentIndex,
      );
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
};

// Shared image input shape for the unified uploader.
type RawImageInput =
  | { kind: "buffer"; fileName: string; mimeType: string; buffer: Buffer }
  | { kind: "url"; url: string };

// Unified upload entry point used by REST and socket paths. URLs pass through;
// buffer inputs are validated and uploaded concurrently to Cloudinary.
const uploadMessageImages = async (
  inputs: RawImageInput[],
): Promise<string[]> => {
  if (inputs.length === 0) return [];
  if (inputs.length > MESSAGE_CONFIG.MAX_IMAGES) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot send more than ${MESSAGE_CONFIG.MAX_IMAGES} images`,
    );
  }

  const bufferFiles: NormalizedSocketFile[] = [];
  const slots: Array<
    { kind: "url"; url: string } | { kind: "buffer"; bufferIndex: number }
  > = [];

  inputs.forEach((input, i) => {
    if (input.kind === "url") {
      slots.push({ kind: "url", url: input.url });
      return;
    }
    validateBufferUpload(input.buffer, input.mimeType, i);
    bufferFiles.push({
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.buffer.length,
      buffer: input.buffer,
    });
    slots.push({ kind: "buffer", bufferIndex: bufferFiles.length - 1 });
  });

  const uploaded = bufferFiles.length
    ? await uploadFilesWithConcurrency(bufferFiles)
    : [];

  return slots.map((slot) =>
    slot.kind === "url" ? slot.url : uploaded[slot.bufferIndex],
  );
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

  // Aggregate unread counts in a single query (groups by sender)
  const userObjectIds = filteredUsers.map((u) => u._id);
  const unreadAggregation = await Message.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        receiverId: new Types.ObjectId(loggedInUserId),
        senderId: { $in: userObjectIds },
        isSeen: false,
      },
    },
    { $group: { _id: "$senderId", count: { $sum: 1 } } },
  ]);

  const unreadByUser = new Map(
    unreadAggregation.map((row) => [row._id.toString(), row.count]),
  );

  return filteredUsers.map((user) => ({
    _id: user._id,
    userName: user.userName || null,
    fullName: user.fullName || null,
    profilePicture: user.profilePicture || null,
    email: user.email || null,
    role: user.role || null,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
    unreadCount: unreadByUser.get(user._id.toString()) ?? 0,
  }));
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
    messages,
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

  // Handle image upload via the unified helper
  let imageUrls: string[] = [];

  // REST API: multipart/form-data files
  if (files && files.length > 0) {
    const inputs: RawImageInput[] = files.map((file, idx) => ({
      kind: "buffer",
      fileName: file.originalname || `rest_file_${Date.now()}_${idx}`,
      mimeType: (file.mimetype || "").toLowerCase(),
      buffer: file.buffer,
    }));
    imageUrls = await uploadMessageImages(inputs);
  }
  // Legacy socket path: URL strings or data-URI base64 strings
  else if (image) {
    const imagesToProcess = (Array.isArray(image) ? image : [image]).filter(
      (s): s is string => typeof s === "string" && s.trim() !== "",
    );

    const inputs: RawImageInput[] = imagesToProcess.map((current, idx) => {
      if (current.startsWith("http")) {
        return { kind: "url", url: current };
      }
      const parsed = parseDataUri(current);
      if (!parsed) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Image ${idx + 1} must be an http(s) URL or a data: URI`,
        );
      }
      return {
        kind: "buffer",
        fileName: `socket_legacy_${Date.now()}_${idx}`,
        mimeType: parsed.mimeType,
        buffer: parsed.buffer,
      };
    });

    imageUrls = await uploadMessageImages(inputs);
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
    ioInstance.to(receiverId.toString()).emit("receive_message", messageData);
  }

  return messageData; // Return the plain object, not the Mongoose document
};

const sendMessageWithSocketFiles = async (
  senderId: string,
  receiverId: string,
  data: {
    text?: string;
    files: SocketFileInput[];
    clientMessageId?: string;
  },
) => {
  const { text, files, clientMessageId } = data;

  if (senderId === receiverId) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.SELF_MESSAGE);
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.EMPTY_MESSAGE);
  }

  if (files.length > MESSAGE_CONFIG.MAX_IMAGES) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot send more than ${MESSAGE_CONFIG.MAX_IMAGES} images`,
    );
  }

  const messageText = text?.trim() || "";
  if (messageText.length > MESSAGE_CONFIG.MAX_TEXT_LENGTH) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Message text cannot exceed ${MESSAGE_CONFIG.MAX_TEXT_LENGTH} characters`,
    );
  }

  cleanupIdempotencyCache();
  const normalizedClientMessageId = clientMessageId?.trim();
  const idempotencyKey = normalizedClientMessageId
    ? `${senderId}:${normalizedClientMessageId}`
    : null;

  if (idempotencyKey) {
    const cached = socketMessageIdempotencyCache.get(idempotencyKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.message;
    }
  }

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

  validateChatPermission(sender.role, receiver.role);

  const normalizedFiles = normalizeSocketFiles(files);
  const totalSizeBytes = normalizedFiles.reduce(
    (acc, file) => acc + file.size,
    0,
  );
  const maxSocketTotalSizeBytes =
    MESSAGE_CONFIG.MAX_SOCKET_TOTAL_SIZE_MB * 1024 * 1024;
  if (totalSizeBytes > maxSocketTotalSizeBytes) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Total file size cannot exceed ${MESSAGE_CONFIG.MAX_SOCKET_TOTAL_SIZE_MB}MB`,
    );
  }

  const imageUrls = await uploadFilesWithConcurrency(normalizedFiles);

  if (!messageText && imageUrls.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.EMPTY_MESSAGE);
  }

  const newMessage = new Message({
    senderId,
    receiverId,
    text: messageText,
    image: imageUrls,
  });

  await newMessage.save();
  const messageData = newMessage.toObject();

  if (ioInstance) {
    ioInstance.to(receiverId.toString()).emit("receive_message", messageData);
  }

  if (idempotencyKey) {
    socketMessageIdempotencyCache.set(idempotencyKey, {
      expiresAt: Date.now() + 2 * 60 * 1000,
      message: messageData,
    });
  }

  return messageData;
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
  sendMessageWithSocketFiles,
  getUnreadMessageCount,
  markMessagesAsRead,
  validateChatPermission,
  canUsersCommunicate,
};
