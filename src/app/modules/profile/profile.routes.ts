import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { profileController } from "./profile.controller";
import { profileValidation } from "./profile.validation";
import { UserRole } from "../../models";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

router.get(
  "/company",
  auth(UserRole.COMPANY),
  profileController.getCompanyProfile,
);

router.patch(
  "/company",
  auth(UserRole.COMPANY),
  fileUploader.upload.single("profilePicture"),
  validateRequest(profileValidation.updateCompanyProfileSchema),
  profileController.updateCompanyProfile,
);

export const profileRoutes = router;
