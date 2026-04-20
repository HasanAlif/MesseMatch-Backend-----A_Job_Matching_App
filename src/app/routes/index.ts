import express from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/user/user.route";
import { jobRoutes } from "../modules/job/job.routes";
import { notificationRoutes } from "../modules/notification/notification.routes";
import { messageRoutes } from "../modules/message/message.routes";
import { matchingRoutes } from "../modules/matching/matching.routes";
import { profileRoutes } from "../modules/profile/profile.routes";
import { appContentRoutes } from "../modules/admin/appContent.route";
import { adminRoutes } from "../modules/admin/admin.routes";

const router = express.Router();

const moduleRoutes = [
  {
    path: "/users",
    route: userRoutes,
  },
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/jobs",
    route: jobRoutes,
  },
  {
    path: "/notifications",
    route: notificationRoutes,
  },
  {
    path: "/messages",
    route: messageRoutes,
  },
  {
    path: "/matches",
    route: matchingRoutes,
  },
  {
    path: "/profile",
    route: profileRoutes,
  },
  {
    path: "/app-content",
    route: appContentRoutes,
  },
  {
    path: "/admin",
    route: adminRoutes,

  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
