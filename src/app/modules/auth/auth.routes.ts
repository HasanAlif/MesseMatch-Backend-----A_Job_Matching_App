import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { UserValidation } from "../user/user.validation";
import { AuthController } from "./auth.controller";
import { authValidation } from "./auth.validation";

const router = express.Router();

// Login
router.post(
  "/login",
  validateRequest(UserValidation.UserLoginValidationSchema),
  AuthController.loginUser,
);

// Logout
router.post("/logout", AuthController.logoutUser);

// Get my profile
router.get("/me", auth(), AuthController.getMyProfile);

// Change password
router.put(
  "/change-password",
  auth(),
  validateRequest(authValidation.changePasswordValidationSchema),
  AuthController.changePassword,
);

// Forgot password - send OTP
router.post(
  "/forgot-password",
  validateRequest(authValidation.forgotPasswordSchema),
  AuthController.forgotPassword,
);

// Resend OTP
router.post(
  "/resend-otp",
  validateRequest(authValidation.resendOtpSchema),
  AuthController.resendOtp,
);

// Verify OTP
router.post(
  "/verify-otp",
  validateRequest(authValidation.verifyOtpSchema),
  AuthController.verifyForgotPasswordOtp,
);

// Reset password
router.post(
  "/reset-password",
  validateRequest(authValidation.resetPasswordValidationSchema),
  AuthController.resetPassword,
);

// Google OAuth - Get auth URL
router.get("/google", AuthController.getGoogleAuthUrl);

// Google OAuth - Callback
router.get("/google/callback", AuthController.googleCallback);

export const authRoutes = router;
