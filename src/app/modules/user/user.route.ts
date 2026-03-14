import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "./user.validation";
import { userController } from "./user.controller";
import auth from "../../middlewares/auth";
import { fileUploader } from "../../../helpars/fileUploader";

const router = express.Router();

router.post(
  "/register",
  validateRequest(UserValidation.CreateUserValidationSchema),
  userController.createUser,
);

router.post(
  "/verify-registration",
  validateRequest(UserValidation.VerifyRegistrationOtpSchema),
  userController.verifyRegistrationOtp,
);

router.post(
  "/resend-registration-otp",
  validateRequest(UserValidation.ResendRegistrationOtpSchema),
  userController.resendRegistrationOtp,
);

router.patch(
  "/complete-profile/fitter",
  auth(),
  fileUploader.upload.single("profilePicture"),
  validateRequest(UserValidation.CompleteProfileAsFitterSchema),
  userController.completeProfileAsFitter,
);

router.patch(
  "/complete-profile/company",
  auth(),
  fileUploader.upload.fields([
    { name: "businessRegDocument", maxCount: 1 },
    { name: "taxIdDocument", maxCount: 1 },
  ]),
  validateRequest(UserValidation.CompleteProfileAsCompanySchema),
  userController.completeProfileAsCompany,
);

export const userRoutes = router;
