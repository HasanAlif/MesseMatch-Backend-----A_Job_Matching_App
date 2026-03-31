import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { User, UserRole } from "../app/models/User.model";
import { Message } from "../app/models/Message.model";
// import { cloudinary } from "../helpars/fileUploader"; // Removed unused import
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
  getReceiverSocketId,
  messageService,
} from "../app/modules/message/message.service";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface SendMessagePayload {
  receiverId: string;
  text?: string;
  image?: string | string[];
}

interface TypingPayload {
  receiverId: string;
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

    // Update user online status
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Track online user
    socket.join(userId);
    setUserOnline(userId, socket.id);

    // Broadcast online users
    io.emit("online_users", getOnlineUserIds());

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

    // Handle: Send message
    socket.on("send_message", async (rawPayload: any) => {
      let payload = rawPayload;
      // Handle case where client sends JSON string instead of object
      if (typeof rawPayload === "string") {
        try {
          payload = JSON.parse(rawPayload);
        } catch (e) {
          socket.emit("message_error", {
            error: "Payload must be a valid JSON object",
          });
          return;
        }
      }

      const { receiverId, text = "", image } = payload;

      try {
        if (!receiverId) {
          socket.emit("message_error", { error: "Receiver ID is required" });
          return;
        }

        // We delegate to messageService.sendMessage to avoid duplicate logic
        const newMessageData = await messageService.sendMessage(
          userId as string,
          receiverId,
          { text, image },
        );

        // Confirm to sender
        socket.emit("message_sent", newMessageData);
      } catch (error: any) {
        socket.emit("message_error", {
          error:
            "Failed to send message: " + (error.message || "Unknown error"),
        });
      }
    });

    // Handle: Typing indicator
    socket.on("typing", (payload: TypingPayload) => {
      const { receiverId } = payload;
      if (!receiverId) return;

      // Better to emit to the room directly
      io.to(receiverId).emit("user_typing", { userId });
    });

    // Handle: Stop typing indicator
    socket.on("stop_typing", (payload: TypingPayload) => {
      const { receiverId } = payload;
      if (!receiverId) return;

      // Better to emit to the room directly
      io.to(receiverId).emit("user_stop_typing", { userId });
    });

    // Handle: Mark messages as read
    socket.on("mark_read", async (payload: { senderId: string }) => {
      const { senderId } = payload;
      if (!senderId) return;

      try {
        await Message.updateMany(
          {
            senderId,
            receiverId: userId,
            isSeen: false,
          },
          {
            $set: { isSeen: true, seenAt: new Date() },
          },
        );

        // Notify sender directly to their room for multi-device support
        io.to(senderId).emit("messages_read", { userId });
      } catch (error) {
        // Silent fail for read status
      }
    });

    // Handle: Get online users
    socket.on("get_online_users", () => {
      socket.emit("online_users", getOnlineUserIds());
    });

    // Handle: Disconnect
    socket.on("disconnect", async () => {
      setUserOffline(userId);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      io.emit("online_users", getOnlineUserIds());
      io.emit("user_offline", { userId, lastSeen: new Date() });
    });
  });
};
