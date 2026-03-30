import * as bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";
import { OAuth2Client } from "google-auth-library";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import emailSender from "../../../shared/emailSender";
import { PASSWORD_RESET_TEMPLATE } from "../../../utils/Template";
import { generateDeviceUUID } from "../../../utils/generateDeviceUUID";
import { AuthProvider, User, DevicePlatform } from "../../models";
import { notificationService } from "../notification/notification.service";

// Initialize Google OAuth client
const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl,
);

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
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

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
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

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

// Get Google OAuth URL
const getGoogleAuthUrl = () => {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const authUrl = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  return { authUrl };
};

// Handle Google OAuth callback
const googleCallback = async (code: string) => {
  // Exchange code for tokens
  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  // Get user info from Google
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token as string,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Failed to get user info from Google",
    );
  }

  const { sub: googleId, email, name, picture } = payload;

  // Check if user exists with this googleId
  let user = await User.findOne({ googleId }).lean();

  if (!user) {
    // Check if user exists with this email (local account)
    user = await User.findOne({ email }).lean();

    if (user) {
      // Link Google account to existing local account
      await User.findByIdAndUpdate(user._id, {
        googleId,
        authProvider: AuthProvider.GOOGLE,
        profilePicture: user.profilePicture || picture,
      });
      user = await User.findById(user._id).lean();
    } else {
      // Create new user with Google account
      const newUser = await User.create({
        fullName: name || "Google User",
        email,
        googleId,
        profilePicture: picture,
        authProvider: AuthProvider.GOOGLE,
      });
      user = await User.findById(newUser._id).lean();
    }
  }

  if (!user) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create user",
    );
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account is inactive or blocked",
    );
  }

  // Generate JWT token
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
  getGoogleAuthUrl,
  googleCallback,
};
