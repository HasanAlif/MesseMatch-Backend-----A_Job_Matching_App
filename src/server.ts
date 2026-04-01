import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import config from "./config";
import "./shared/database";
import app, { corsOptions } from "./app";
import { initializeFirebase } from "./shared/firebase";
import { socketHandler } from "./socket/socketHandler";
import { MESSAGE_CONFIG } from "./app/modules/message/message.constants";

let server: HttpServer;
let io: SocketIOServer;

async function startServer() {
  server = app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
  });

  // Initialize Socket.IO
  io = new SocketIOServer(server, {
    cors: {
      origin: corsOptions.origin,
      methods: corsOptions.methods,
      credentials: corsOptions.credentials,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["websocket", "polling"],
    maxHttpBufferSize: MESSAGE_CONFIG.MAX_SOCKET_TOTAL_SIZE_MB * 1024 * 1024,
  });

  // Initialize socket handlers
  socketHandler(io);
  console.log("Socket.IO initialized");
}

async function main() {
  // Initialize Firebase (optional - app works without it)
  try {
    initializeFirebase();
  } catch (error) {
    console.warn("Firebase initialization skipped:", (error as Error).message);
  }

  await startServer();
  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info("Server closed!");
        restartServer();
      });
    } else {
      process.exit(1);
    }
  };

  const restartServer = () => {
    console.info("Restarting server...");
    main();
  };

  process.on("uncaughtException", (error) => {
    console.log("Uncaught Exception: ", error);
    exitHandler();
  });

  process.on("unhandledRejection", (error) => {
    console.log("Unhandled Rejection: ", error);
    exitHandler();
  });

  // Handling the server shutdown with SIGTERM and SIGINT
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received. Shutting down gracefully...");
    exitHandler();
  });

  process.on("SIGINT", () => {
    console.log("SIGINT signal received. Shutting down gracefully...");
    exitHandler();
  });
}

main();
