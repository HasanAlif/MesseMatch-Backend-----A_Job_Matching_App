import { User } from "../../models";
import * as bcrypt from "bcrypt";
import crypto from "crypto";
import httpStatus from "http-status";
import config from "../../../config";
import ApiError from "../../../errors/ApiErrors";
import { jwtHelpers } from "../../../helpars/jwtHelpers";
import emailSender from "../../../shared/emailSender";
import { EMAIL_VERIFICATION_TEMPLATE } from "../../../utils/Template";
import { fileUploader } from "../../../helpars/fileUploader";
import { UserRole } from "../../models/User.model";

// Create a new user - Registration with OTP verification
const createUserIntoDb = async (payload: {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
}) => {
  // Check if user already exists and is verified
  const existingUser = await User.findOne({ email: payload.email });
  if (existingUser && existingUser.isVerified) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "User with this email already exists",
    );
  }

  // Check if mobile number already exists (among verified users)
  const existingMobile = await User.findOne({
    mobileNumber: payload.mobileNumber,
    isVerified: true,
  });
  if (existingMobile) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "User with this mobile number already exists",
    );
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(config.bcrypt_salt_rounds),
  );

  // Generate OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  let user;

  if (existingUser && !existingUser.isVerified) {
    // Update existing unverified user with new data
    user = await User.findByIdAndUpdate(
      existingUser._id,
      {
        fullName: payload.fullName,
        mobileNumber: payload.mobileNumber,
        password: hashedPassword,
        verificationOtp: otp,
        verificationOtpExpiry: otpExpiry,
      },
      { new: true },
    );
  } else {
    // Create new user with isVerified: false
    user = await User.create({
      fullName: payload.fullName,
      email: payload.email,
      mobileNumber: payload.mobileNumber,
      password: hashedPassword,
      isVerified: false,
      verificationOtp: otp,
      verificationOtpExpiry: otpExpiry,
    });
  }

  // Send verification OTP email
  await emailSender(
    payload.email,
    EMAIL_VERIFICATION_TEMPLATE(otp),
    "Email Verification OTP - MesseMatch",
  );

  return {
    message: "OTP sent to your email. Please verify to complete registration.",
    email: payload.email,
    otp,
  };
};

// Verify registration OTP and activate user
const verifyRegistrationOtp = async (payload: {
  email: string;
  otp: string;
}) => {
  const user = await User.findOne({ email: payload.email }).select(
    "+verificationOtp +verificationOtpExpiry",
  );

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email is already verified");
  }

  if (
    !user.verificationOtp ||
    !user.verificationOtpExpiry ||
    user.verificationOtp !== payload.otp ||
    user.verificationOtpExpiry < new Date()
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP");
  }

  // Mark user as verified and clear OTP fields
  await User.findByIdAndUpdate(user._id, {
    isVerified: true,
    verificationOtp: undefined,
    verificationOtpExpiry: undefined,
  });

  // Generate token
  const token = jwtHelpers.generateToken(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    config.jwt.jwt_secret as string,
    config.jwt.expires_in as string,
  );

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      createdAt: user.createdAt,
    },
    token,
  };
};

// Resend registration OTP
const resendRegistrationOtp = async (email: string) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Email is already verified");
  }

  // Generate new OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  await User.findByIdAndUpdate(user._id, {
    verificationOtp: otp,
    verificationOtpExpiry: otpExpiry,
  });

  // Send verification OTP email
  await emailSender(
    email,
    EMAIL_VERIFICATION_TEMPLATE(otp),
    "Email Verification OTP - MesseMatch",
  );

  return {
    message: "OTP resent to your email",
    email,
    otp,
  };
};

const completeProfileAsFitter = async (
  userId: string,
  payload: {
    UserRole?: string;
    language?: string;
    userName?: string;
    fullName?: string;
    postalCode?: string;
    workLocations?: string[];
    skills?: string[];
    spokenLanguages?: string[];
    driversLicense?: string;
    hourlyRate?: number;
    dailyRate?: number;
    experienceYears?: number;
    bio?: string;
    plan?: string;
    lattitude?: number;
    longitude?: number;
  },
  profilePictureFile?: Express.Multer.File,
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const updateData: Record<string, unknown> = {
    ...payload,
    role: UserRole.FITTER,
  };

  if (profilePictureFile) {
    const uploaded = await fileUploader.uploadToCloudinary(
      profilePictureFile,
      "messematch/profiles",
    );
    updateData.profilePicture = uploaded.Location;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  return updatedUser;
};

const completeProfileAsCompany = async (
  userId: string,
  payload: {
    UserRole?: string;
    companyName?: string;
    businessEmail?: string;
    contactPersonName?: string;
    postalCode?: string;
    lattitude?: number;
    longitude?: number;
  },
  files?: {
    businessRegDocument?: Express.Multer.File;
    taxIdDocument?: Express.Multer.File;
  },
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const updateData: Record<string, unknown> = {
    ...payload,
    role: UserRole.COMPANY,
  };

  // Upload documents to Cloudinary in parallel for maximum performance
  const [businessRegResult, taxIdResult] = await Promise.all([
    files?.businessRegDocument
      ? fileUploader.uploadToCloudinary(
          files.businessRegDocument,
          "messematch/documents",
        )
      : null,
    files?.taxIdDocument
      ? fileUploader.uploadToCloudinary(
          files.taxIdDocument,
          "messematch/documents",
        )
      : null,
  ]);

  if (businessRegResult)
    updateData.businessRegDocument = businessRegResult.Location;
  if (taxIdResult) updateData.taxIdDocument = taxIdResult.Location;

  // Auto-grant verification badge when both documents are present
  const hasBusinessReg = businessRegResult || !!user.businessRegDocument;
  const hasTaxId = taxIdResult || !!user.taxIdDocument;
  if (hasBusinessReg && hasTaxId) {
    updateData.hasVerificationBadge = true;
  }

  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  return updatedUser;
};

export const userService = {
  createUserIntoDb,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  completeProfileAsFitter,
  completeProfileAsCompany,
};
