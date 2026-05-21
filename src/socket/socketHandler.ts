import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { User, UserRole } from "../app/models/User.model";
import config from "../config";
import {
  ALLOWED_CHAT_PAIRS,
  MESSAGE_CONFIG,
} from "../app/modules/message/message.constants";
import {
  setIO,
  setUserOnline,
  setUserOffline,
  getOnlineUserIds,
  messageService,
} from "../app/modules/message/message.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface SocketBinaryFilePayload {
  fileName?: string;
  mimeType?: string;
  size?: number;
  data?: unknown;
  buffer?: unknown;
}

interface SendMessagePayload {
  receiverId: string;
  text?: string;
  image?: string | string[];
  files?: SocketBinaryFilePayload[];
  clientMessageId?: string;
}

interface TypingPayload {
  receiverId: string;
}

interface MarkReadPayload {
  senderId?: string;
  receiverId?: string;
}

export const socketHandler = (io: Server) => {
  setIO(io);

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.headers.authorization?.split(" ")[1] ||
        socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: Token missing"));
      }

      const secret = config.jwt.jwt_secret;
      const decoded = jwt.verify(token, secret!) as {
        id: string;
        role: string;
      };

      if (!decoded?.id) {
        return next(new Error("Authentication error: Invalid token payload"));
      }

      // Verify user exists and can chat
      const user = await User.findById(decoded.id).select("_id role status");
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      if (user.status !== "ACTIVE") {
        return next(new Error("Authentication error: User is not active"));
      }

      // Only FITTER and COMPANY can use chat
      if (user.role !== UserRole.FITTER && user.role !== UserRole.COMPANY) {
        return next(
          new Error(
            "Authentication error: Only Fitter and Company can use chat",
          ),
        );
      }

      socket.userId = decoded.id;
      socket.userRole = user.role;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket: AuthenticatedSocket) => {
    const userId = socket.userId;
    const userRole = socket.userRole;

    if (!userId || !userRole) {
      socket.disconnect();
      return;
    }

    socket.join(userId);
    const wasOffline = setUserOnline(userId, socket.id);

    if (wasOffline) {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
      } catch (err) {
        console.error(
          "Failed to mark user online in DB:",
          (err as Error).message,
        );
      }
      io.emit("user_online", { userId });
    }

    // Per-event sliding-window rate limiter with O(1) amortized head advancement.
    const eventBuckets = new Map<string, { times: number[]; head: number }>();
    const isRateLimited = (
      eventName: string,
      maxEvents: number,
      windowMs: number,
    ) => {
      let bucket = eventBuckets.get(eventName);
      if (!bucket) {
        bucket = { times: [], head: 0 };
        eventBuckets.set(eventName, bucket);
      }
      const now = Date.now();
      while (
        bucket.head < bucket.times.length &&
        now - bucket.times[bucket.head] > windowMs
      ) {
        bucket.head += 1;
      }
      const active = bucket.times.length - bucket.head;
      if (active >= maxEvents) return true;
      bucket.times.push(now);
      // Compact occasionally so the array doesn't grow without bound.
      if (bucket.head > 64) {
        bucket.times = bucket.times.slice(bucket.head);
        bucket.head = 0;
      }
      return false;
    };

    const parseSocketPayload = (rawPayload: any, eventName: string) => {
      let payload = rawPayload;
      if (typeof rawPayload === "string") {
        try {
          payload = JSON.parse(rawPayload);
        } catch {
          socket.emit("message_error", {
            error: `${eventName} payload must be a valid JSON object`,
          });
          return null;
        }
      }

      if (!payload || typeof payload !== "object") {
        socket.emit("message_error", {
          error: `${eventName} payload must be an object`,
        });
        return null;
      }

      return payload;
    };

    // Handle: Get list of chattable users
    socket.on("users_list", async () => {
      try {
        const allowedRoles = ALLOWED_CHAT_PAIRS[userRole] || [];

        const users = await User.find({
          _id: { $ne: userId },
          role: { $in: allowedRoles },
          status: "ACTIVE",
        }).select(
          "_id userName fullName email role profilePicture isOnline lastSeen",
        );

        socket.emit("users_list_response", users);
      } catch (error) {
        socket.emit("message_error", { error: "Failed to fetch users" });
      }
    });

    // Handle: Send message (text, legacy URL/data-URI image strings, or binary files)
    socket.on("send_message", async (rawPayload: any) => {
      const payload = parseSocketPayload(rawPayload, "send_message");
      if (!payload) return;

      if (isRateLimited("send_message", 20, 10_000)) {
        socket.emit("message_error", {
          error: "Too many requests. Please try again shortly.",
        });
        return;
      }

      const {
        receiverId,
        text = "",
        image,
        files,
        clientMessageId,
      } = payload as SendMessagePayload;

      try {
        if (!receiverId) {
          socket.emit("message_error", { error: "Receiver ID is required" });
          return;
        }

        const newMessageData = await messageService.sendMessage(
          userId as string,
          String(receiverId),
          { text, image, files, clientMessageId },
        );

        socket.emit("message_sent", newMessageData);
      } catch (error: any) {
        socket.emit("message_error", {
          error:
            "Failed to send message: " + (error.message || "Unknown error"),
        });
      }
    });

    // Handle: Send message with binary files (frontend primary event)
    socket.on("send_message_files", async (rawPayload: any) => {
      const payload = parseSocketPayload(rawPayload, "send_message_files");
      if (!payload) return;

      if (isRateLimited("send_message_files", 12, 10_000)) {
        socket.emit("message_error", {
          error: "Too many upload requests. Please try again shortly.",
        });
        return;
      }

      const {
        receiverId,
        text = "",
        files,
        clientMessageId,
      } = payload as SendMessagePayload;

      try {
        if (!receiverId) {
          socket.emit("message_error", { error: "Receiver ID is required" });
          return;
        }

        if (!Array.isArray(files) || files.length === 0) {
          socket.emit("message_error", {
            error: "At least one file is required",
          });
          return;
        }

        if (files.length > MESSAGE_CONFIG.MAX_IMAGES) {
          socket.emit("message_error", {
            error: `Cannot send more than ${MESSAGE_CONFIG.MAX_IMAGES} images`,
          });
          return;
        }

        const newMessageData = await messageService.sendMessage(
          userId as string,
          String(receiverId),
          { text, files, clientMessageId },
        );

        socket.emit("message_sent", newMessageData);
      } catch (error: any) {
        socket.emit("message_error", {
          error: "Failed to send files: " + (error.message || "Unknown error"),
        });
      }
    });

    // Handle: Typing indicator
    socket.on("typing", (rawPayload: TypingPayload | string) => {
      const payload = parseSocketPayload(rawPayload, "typing");
      if (!payload) return;

      const { receiverId } = payload as TypingPayload;
      if (!receiverId) return;

      const receiverRoom = String(receiverId);
      io.to(receiverRoom).emit("user_typing", { userId });
      // Backward-compatible alias for existing clients listening to 'typing'
      io.to(receiverRoom).emit("typing", { userId });
    });

    // Handle: Stop typing indicator
    socket.on("stop_typing", (rawPayload: TypingPayload | string) => {
      const payload = parseSocketPayload(rawPayload, "stop_typing");
      if (!payload) return;

      const { receiverId } = payload as TypingPayload;
      if (!receiverId) return;

      const receiverRoom = String(receiverId);
      io.to(receiverRoom).emit("user_stop_typing", { userId });
      // Backward-compatible alias for existing clients listening to 'stop_typing'
      io.to(receiverRoom).emit("stop_typing", { userId });
    });

    // Handle: Mark messages as read
    socket.on("mark_read", async (rawPayload: MarkReadPayload | string) => {
      const payload = parseSocketPayload(rawPayload, "mark_read");
      if (!payload) return;

      // Accept both keys for compatibility: senderId (preferred) and receiverId (legacy client)
      const senderId =
        (payload as MarkReadPayload).senderId ||
        (payload as MarkReadPayload).receiverId;
      if (!senderId) return;

      try {
        await messageService.markMessagesAsRead(
          userId as string,
          String(senderId),
        );
        // Backward-compatible alias for existing clients listening to 'mark_read'
        // (service already emits the canonical 'messages_read' event)
        io.to(String(senderId)).emit("mark_read", { userId });
      } catch {
        socket.emit("message_error", {
          error: "Failed to mark messages as read",
        });
      }
    });

    // Handle: Get online users
    socket.on("get_online_users", () => {
      socket.emit("online_users", getOnlineUserIds());
    });

    // Handle: Disconnect
    socket.on("disconnect", async () => {
      const isFullyOffline = setUserOffline(userId, socket.id);

      if (isFullyOffline) {
        const lastSeen = new Date();
        try {
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen,
          });
        } catch (err) {
          console.error(
            "Failed to mark user offline in DB:",
            (err as Error).message,
          );
        }
        io.emit("user_offline", { userId, lastSeen });
      }
    });
  });
};
