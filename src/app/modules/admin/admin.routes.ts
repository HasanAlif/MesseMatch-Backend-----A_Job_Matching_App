import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { adminController } from "./admin.controller";
import { adminValidation } from "./admin.validation";
import { UserRole } from "../../models";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

router.get(
  "/monthly-user-growth",
  auth(UserRole.ADMIN),
  validateRequest(adminValidation.getMonthlyUserGrowthSchema),
  adminController.getMonthlyUserGrowth,
);

router.get(
  "/recent-users",
  auth(UserRole.ADMIN),
  adminController.getRecentUsers,
);

router.get(
  "/users",
  auth(UserRole.ADMIN),
  validateRequest(adminValidation.getAllUsersSchema),
  adminController.getAllUsers,
);

router.get(
  "/users/search",
  auth(UserRole.ADMIN),
  validateRequest(adminValidation.searchUsersSchema),
  adminController.searchUsers,
);

router.get("/profile", auth(UserRole.ADMIN), adminController.getAdminProfile);

router.put(
  "/profile",
  auth(UserRole.ADMIN),
  fileUploader.upload.single("profilePictureFile"),
  validateRequest(adminValidation.updateAdminProfileSchema),
  adminController.updateAdminProfile,
);

export const adminRoutes = router;
