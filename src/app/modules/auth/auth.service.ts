import * as bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import emailSender from "../../../shared/emailSender";
import { PASSWORD_RESET_TEMPLATE } from "../../../utils/Template";
import { generateDeviceUUID } from "../../../utils/generateDeviceUUID";
import { AuthProvider, User, DevicePlatform } from "../../models";
import { notificationService } from "../notification/notification.service";

// User login
const loginUser = async (payload: {
  email: string;
  password: string;
  fcmToken?: string;
  deviceId?: string;
  platform?: DevicePlatform;
  deviceName?: string;
}) => {
  const userData = await User.findOne({ email: payload.email })
    .select("+password")
    .lean();

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, "Invalid email or password");
  }

  if (userData.status !== "ACTIVE") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account is inactive or blocked",
    );
  }

  // Check if user is verified
  if (!userData.isVerified) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Please verify your email before logging in",
    );
  }

  // Check if user is Google-only (no password)
  if (!userData.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This account uses Google sign-in. Please continue with Google.",
    );
  }

  const isPasswordValid = await bcrypt.compare(
    payload.password,
    userData.password,
  );
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  // BULLETPROOF: Device registration with error isolation
  let deviceRegistrationError: string | null = null;
  if (payload.fcmToken && payload.deviceId && payload.platform) {
    try {
      // Convert deviceId string to deterministic UUID v5
      const deviceUUID = generateDeviceUUID(payload.deviceId.trim());

      await notificationService.registerFcmToken({
        userId: userData._id.toString(),
        deviceId: deviceUUID,
        fcmToken: payload.fcmToken.trim(),
        platform: payload.platform,
        deviceName: payload.deviceName?.trim(),
      });
    } catch (error) {
      // Log warning but don't fail login - track error for response
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.warn(
        `[AUTH] Device registration failed for user ${userData._id} at login: ${errorMsg}`,
      );
      deviceRegistrationError = `Device registration failed: ${errorMsg}`;
      // Continue with login - authentication succeeded
    }
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: userData._id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  const {
    password,
    resetPasswordOtp,
    resetPasswordOtpExpiry,
    ...userWithoutSensitive
  } = userData;

  return {
    token: accessToken,
    user: userWithoutSensitive,
    deviceRegistrationError, // Include in response if error occurred
  };
};

// Logout user - clear auth and optionally remove device
const logoutUser = async (userId: string, deviceId?: string) => {
  let deviceRemovalError: string | null = null;

  if (deviceId) {
    try {
      // Convert deviceId string to deterministic UUID v5 (same as login)
      const deviceUUID = generateDeviceUUID(deviceId.trim());

      await notificationService.removeFcmToken({
        userId,
        deviceId: deviceUUID,
      });
    } catch (error) {
      // Log error but don't fail logout - track error for response
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[AUTH] Device removal failed for user ${userId} at logout: ${errorMsg}`,
      );
      deviceRemovalError = `Device removal failed: ${errorMsg}`;
      // Continue logout - authentication was already cleared
    }
  }

  return {
    message: "Logged out successfully",
    deviceRemovalError, // Include in response if error occurred
  };
};
const getMyProfile = async (userId: string) => {
  const userProfile = await User.findById(userId)
    .select(
      "_id fullName email mobileNumber profilePicture role status premiumPlan premiumPlanExpiry isEnjoyedTrial country currency language timezone monthStartDate createdAt",
    )
    .lean();

  if (!userProfile) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return userProfile;
};

// Change password
const changePassword = async (
  userId: string,
  newPassword: string,
  oldPassword: string,
) => {
  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // Check if user has a password (Google users might not)
  if (!user.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot change password for Google sign-in accounts. Please set a password first.",
    );
  }

  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findByIdAndUpdate(userId, { password: hashedPassword });

  return { message: "Password changed successfully" };
};

// Forgot password - Send OTP
const forgotPassword = async (payload: { email: string }) => {
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No account found with this email",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 60 * 1000); // 1 minute

  await User.findByIdAndUpdate(user._id, {
    resetPasswordOtp: otp,
    resetPasswordOtpExpiry: otpExpiry,
  });

  await emailSender(
    payload.email,
    PASSWORD_RESET_TEMPLATE(otp),
    "Password Reset OTP -  MesseMatch",
  );

  return { message: "OTP sent to your email", otp }; // Return OTP for testing purposes only But Should be removed in production
};

// Resend OTP
const resendOtp = async (email: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "No account found with this email",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 60 * 1000); // 1 minute

  await User.findByIdAndUpdate(user._id, {
    resetPasswordOtp: otp,
    resetPasswordOtpExpiry: otpExpiry,
  });

  await emailSender(
    email,
    PASSWORD_RESET_TEMPLATE(otp),
    "Password Reset OTP - MesseMatch",
  );

  return { message: "OTP resent to your email", otp }; // Return OTP for testing purposes only
};

// Verify OTP
const verifyForgotPasswordOtp = async (payload: {
  email: string;
  otp: string;
}) => {
  const user = await User.findOne({ email: payload.email }).select(
    "+resetPasswordOtp +resetPasswordOtpExpiry",
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    !user.resetPasswordOtp ||
    !user.resetPasswordOtpExpiry ||
    user.resetPasswordOtp !== payload.otp ||
    user.resetPasswordOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  return { message: "OTP verified successfully", isValid: true };
};

// Reset password
const resetPassword = async (
  email: string,
  newPassword: string,
  confirmPassword: string,
  otp: string,
) => {
  if (newPassword !== confirmPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Passwords do not match");
  }

  const user = await User.findOne({ email }).select(
    "+resetPasswordOtp +resetPasswordOtpExpiry",
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    !user.resetPasswordOtp ||
    !user.resetPasswordOtpExpiry ||
    user.resetPasswordOtp !== otp ||
    user.resetPasswordOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  await User.findByIdAndUpdate(user._id, {
    password: hashedPassword,
    resetPasswordOtp: undefined,
    resetPasswordOtpExpiry: undefined,
  });

  return { message: "Password reset successfully" };
};

const socialLogin = async (payload: {
  email: string;
  name: string;
  profileImage?: string;
  provider: AuthProvider;
  providerId: string;
  fcmToken?: string;
  deviceId?: string;
  deviceType?: DevicePlatform;
  deviceName?: string;
}) => {
  const {
    email,
    name,
    profileImage,
    provider,
    providerId,
    fcmToken,
    deviceId,
    deviceType,
    deviceName,
  } = payload;

  let user = await User.findOne({ email }).lean();

  if (user) {
    if (user.authProvider === AuthProvider.LOCAL) {
      await User.findByIdAndUpdate(user._id, {
        googleId: providerId,
        authProvider: provider,
        profilePicture: user.profilePicture || profileImage,
      });
      user = await User.findById(user._id).lean();
    } else if (user.googleId && user.googleId !== providerId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "This email is already registered with a different Google account",
      );
    }
  } else {
    const newUser = await User.create({
      fullName: name,
      email,
      googleId: providerId,
      profilePicture: profileImage,
      authProvider: provider,
    });
    user = await User.findById(newUser._id).lean();
  }

  if (!user) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create or retrieve user",
    );
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account is inactive or blocked",
    );
  }

  if (fcmToken && deviceId && deviceType) {
    const deviceUUID = generateDeviceUUID(deviceId.trim());
    await notificationService.registerFcmToken({
      userId: user._id.toString(),
      deviceId: deviceUUID,
      fcmToken: fcmToken.trim(),
      platform: deviceType,
      deviceName: deviceName?.trim(),
    });
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  const {
    password,
    resetPasswordOtp,
    resetPasswordOtpExpiry,
    ...userWithoutSensitive
  } = user as any;

  return { token: accessToken, user: userWithoutSensitive };
};

export const authService = {
  loginUser,
  logoutUser,
  getMyProfile,
  changePassword,
  forgotPassword,
  resendOtp,
  verifyForgotPasswordOtp,
  resetPassword,
  socialLogin,
};
