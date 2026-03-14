import { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../../config";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../../shared/sendResponse";
import { authService } from "./auth.service";

// Login
const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body);

  res.cookie("token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Login successful",
    data: result,
  });
});

// Logout
const logoutUser = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logout successful",
    data: null,
  });
});

// Get my profile
const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.getMyProfile(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

// Change password
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const result = await authService.changePassword(
    req.user.id,
    newPassword,
    oldPassword,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: result,
  });
});

// Forgot password
const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent to your email",
    data: result,
  });
});

// Resend OTP
const resendOtp = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.resendOtp(req.body.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP resent to your email",
    data: result,
  });
});

// Verify OTP
const verifyForgotPasswordOtp = catchAsync(
  async (req: Request, res: Response) => {
    const result = await authService.verifyForgotPasswordOtp(req.body);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "OTP verified successfully",
      data: result,
    });
  },
);

// Reset password
const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { email, newPassword, confirmPassword, otp } = req.body;
  const result = await authService.resetPassword(
    email,
    newPassword,
    confirmPassword,
    otp,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successful",
    data: result,
  });
});

// Get Google Auth URL
const getGoogleAuthUrl = catchAsync(async (req: Request, res: Response) => {
  const result = authService.getGoogleAuthUrl();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Google auth URL generated",
    data: result,
  });
});

// Google OAuth Callback
const googleCallback = catchAsync(async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.redirect(
      `${config.frontendUrl}/auth/error?message=Invalid authorization code`,
    );
  }

  const result = await authService.googleCallback(code);

  // Set cookie
  res.cookie("token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  // Redirect to frontend with token
  res.redirect(`${config.frontendUrl}/auth/callback?token=${result.token}`);
});

export const AuthController = {
  loginUser,
  logoutUser,
  getMyProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  resendOtp,
  verifyForgotPasswordOtp,
  getGoogleAuthUrl,
  googleCallback,
};
