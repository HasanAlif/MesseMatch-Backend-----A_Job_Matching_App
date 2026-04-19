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

router.get(
  "/company/info",
  auth(UserRole.COMPANY),
  profileController.getCompanyInfo,
);

router.patch(
  "/company/info",
  auth(UserRole.COMPANY),
  profileController.updateCompanyInfo,
);

router.post(
  "/change-password",
  auth(),
  validateRequest(profileValidation.changePasswordSchema),
  profileController.changePassword,
);

router.get(
  "/fitter",
  auth(UserRole.FITTER),
  profileController.getFitterProfile,
);

router.get(
  "/fitter/update",
  auth(UserRole.FITTER),
  profileController.getFitterProfileForUpdate,
);

router.patch(
  "/fitter/update",
  auth(UserRole.FITTER),
  fileUploader.upload.single("profilePicture"),
  profileController.updateFitterProfile,
);

router.get(
  "/fitter/skills-languages-licenses/update",
  auth(UserRole.FITTER),
  profileController.getSkillsLanguagesAndLicensesForUpdate,
);

router.patch(
  "/fitter/skills-languages-licenses/update",
  auth(UserRole.FITTER),
  validateRequest(profileValidation.updateSkillsLanguagesAndLicensesSchema),
  profileController.updateSkillsLanguagesAndLicenses,
);

export const profileRoutes = router;
