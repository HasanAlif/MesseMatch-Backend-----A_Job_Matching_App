import { Request, Response } from "express";
import httpStatus from "http-status";
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

  // Prepare response data
  const responseData: any = {
    token: result.token,
    user: result.user,
  };

  // Include device error if present (non-blocking)
  if (result.deviceRegistrationError) {
    responseData.deviceError = result.deviceRegistrationError;
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.deviceRegistrationError
      ? "Login successful but device registration failed"
      : "Login successful",
    data: responseData,
  });
});

// Logout
const logoutUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id; // From @Auth() middleware
  const { deviceId } = req.body;

  // Clear authentication cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  // Remove device if userId and deviceId provided
  let responseData: any = null;
  if (userId && deviceId) {
    const result = await authService.logoutUser(userId, deviceId);
    if (result.deviceRemovalError) {
      responseData = { deviceError: result.deviceRemovalError };
    }
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logout successful",
    data: responseData,
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

const socialLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.socialLogin(req.body);

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
    message: "Social login successful",
    data: result,
  });
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
  socialLogin,
};
