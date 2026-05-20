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

// Validate chat permission between two roles. Throws ApiError if not allowed.
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

let ioInstance: any = null;
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

/** Returns true when this is the user's first connected socket (newly online). */
export const setUserOnline = (userId: string, socketId: string): boolean => {
  let sockets = onlineUsers.get(userId);
  const wasOffline = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Set<string>();
    onlineUsers.set(userId, sockets);
  }
  sockets.add(socketId);
  return wasOffline;
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

interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

const uploadBufferToCloudinary = async (
  file: NormalizedSocketFile,
  index: number,
): Promise<CloudinaryUploadResult> => {
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

        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const uploadFilesWithConcurrency = async (
  files: NormalizedSocketFile[],
): Promise<CloudinaryUploadResult[]> => {
  const concurrency = Math.max(
    1,
    MESSAGE_CONFIG.SOCKET_FILE_UPLOAD_CONCURRENCY,
  );
  const results: CloudinaryUploadResult[] = new Array(files.length);
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

const uploadMessageImages = async (
  inputs: RawImageInput[],
): Promise<CloudinaryUploadResult[]> => {
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
    slot.kind === "url"
      ? { url: slot.url, publicId: "" }
      : uploaded[slot.bufferIndex],
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

  const myObjectId = new Types.ObjectId(loggedInUserId);
  const partners = await Message.aggregate<{
    _id: Types.ObjectId;
    unreadCount: number;
    lastMessageAt: Date;
  }>([
    {
      $match: {
        $or: [{ senderId: myObjectId }, { receiverId: myObjectId }],
      },
    },
    {
      $project: {
        createdAt: 1,
        partnerId: {
          $cond: [
            { $eq: ["$senderId", myObjectId] },
            "$receiverId",
            "$senderId",
          ],
        },
        unreadFromPartner: {
          $cond: [
            {
              $and: [
                { $eq: ["$receiverId", myObjectId] },
                { $eq: ["$isSeen", false] },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: "$partnerId",
        unreadCount: { $sum: "$unreadFromPartner" },
        lastMessageAt: { $max: "$createdAt" },
      },
    },
    { $sort: { lastMessageAt: -1 } },
  ]);

  if (partners.length === 0) {
    return [];
  }

  const allowedUsers = await User.find({
    _id: { $in: partners.map((p) => p._id) },
    role: { $in: allowedRoles },
    status: UserStatus.ACTIVE,
  }).select(
    "_id userName fullName email role profilePicture isOnline lastSeen",
  );

  const userById = new Map(allowedUsers.map((u) => [u._id.toString(), u]));

  return partners
    .map((p) => {
      const user = userById.get(p._id.toString());
      if (!user) return null;
      return {
        _id: user._id,
        userName: user.userName || null,
        fullName: user.fullName || null,
        profilePicture: user.profilePicture || null,
        email: user.email || null,
        role: user.role || null,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        unreadCount: p.unreadCount,
        lastMessageAt: p.lastMessageAt,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
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
    User.findById(userToChatId).select(
      "role status userName fullName profilePicture isOnline",
    ),
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

  const receiverData = {
    _id: otherUser._id,
    userName: otherUser.userName || null,
    fullName: otherUser.fullName || null,
    profilePicture: otherUser.profilePicture || null,
    isOnline: otherUser.isOnline,
  };

  return {
    receiver: receiverData,
    messages,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

const sendMessage = async (
  senderId: string,
  receiverId: string,
  data: {
    text?: string;
    files?: SocketFileInput[];
    image?: string | string[];
    clientMessageId?: string;
  },
) => {
  const { text, files, image, clientMessageId } = data;

  if (senderId === receiverId) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.SELF_MESSAGE);
  }

  // Idempotency: short-circuit if this client message was already processed.
  cleanupIdempotencyCache();
  const normalizedClientMessageId = clientMessageId?.trim();
  const idempotencyKey = normalizedClientMessageId
    ? `${senderId}:${normalizedClientMessageId}`
    : null;
  if (idempotencyKey) {
    const cached = socketMessageIdempotencyCache.get(idempotencyKey);
    if (cached && cached.expiresAt > Date.now()) return cached.message;
  }

  const hasFiles = Array.isArray(files) && files.length > 0;
  const hasImage = !!image;
  const messageText = text?.trim() || "";

  if (!messageText && !hasFiles && !hasImage) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.EMPTY_MESSAGE);
  }

  if (messageText.length > MESSAGE_CONFIG.MAX_TEXT_LENGTH) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Message text cannot exceed ${MESSAGE_CONFIG.MAX_TEXT_LENGTH} characters`,
    );
  }

  const users = await User.find({
    _id: { $in: [senderId, receiverId] },
  }).select("_id role status userName fullName profilePicture isOnline");
  const sender = users.find((u) => u._id.toString() === senderId);
  const receiver = users.find((u) => u._id.toString() === receiverId);

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

  // Image upload — binary files take priority over legacy image strings.
  let uploads: CloudinaryUploadResult[] = [];
  if (hasFiles) {
    const normalizedFiles = normalizeSocketFiles(files!);
    const totalBytes = normalizedFiles.reduce((acc, f) => acc + f.size, 0);
    const maxBytes = MESSAGE_CONFIG.MAX_SOCKET_TOTAL_SIZE_MB * 1024 * 1024;
    if (totalBytes > maxBytes) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Total file size cannot exceed ${MESSAGE_CONFIG.MAX_SOCKET_TOTAL_SIZE_MB}MB`,
      );
    }
    uploads = await uploadFilesWithConcurrency(normalizedFiles);
  } else if (hasImage) {
    const list = (Array.isArray(image) ? image : [image!]).filter(
      (s): s is string => typeof s === "string" && s.trim() !== "",
    );
    const inputs: RawImageInput[] = list.map((current, i) => {
      if (current.startsWith("http")) return { kind: "url", url: current };
      const parsed = parseDataUri(current);
      if (!parsed) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          `Image ${i + 1} must be an http(s) URL or a data: URI`,
        );
      }
      return {
        kind: "buffer",
        fileName: `socket_legacy_${Date.now()}_${i}`,
        mimeType: parsed.mimeType,
        buffer: parsed.buffer,
      };
    });
    uploads = await uploadMessageImages(inputs);
  }

  if (!messageText && uploads.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, MESSAGE_ERRORS.EMPTY_MESSAGE);
  }

  const newMessage = new Message({
    senderId,
    receiverId,
    text: messageText,
    image: uploads.map((u) => u.url),
    imagePublicIds: uploads.map((u) => u.publicId),
  });
  await newMessage.save();

  const messageData = {
    ...newMessage.toObject(),
    sender: {
      _id: sender._id,
      userName: sender.userName || null,
      fullName: sender.fullName || null,
      profilePicture: sender.profilePicture || null,
      isOnline: sender.isOnline,
    },
  };

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

// Get count of distinct senders with unread messages for the given user.
const getUnreadMessageCount = async (userId: string) => {
  const [result] = await Message.aggregate<{ n: number }>([
    {
      $match: {
        receiverId: new Types.ObjectId(userId),
        isSeen: false,
      },
    },
    { $group: { _id: "$senderId" } },
    { $count: "n" },
  ]);

  return { unreadCount: result?.n ?? 0 };
};

// Mark messages as read. Emits 'messages_read' only when rows actually changed.
const markMessagesAsRead = async (userId: string, senderId: string) => {
  const result = await Message.updateMany(
    {
      senderId: senderId,
      receiverId: userId,
      isSeen: false,
    },
    {
      $set: { isSeen: true, seenAt: new Date() },
    },
  );

  if (result.modifiedCount === 0) return;

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
