import mongoose, { Document, Schema } from "mongoose";

export enum UserRole {
  ADMIN = "ADMIN",
  FITTER = "FITTER",
  COMPANY = "COMPANY",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPEND = "SUSPEND",
}

export enum AuthProvider {
  LOCAL = "LOCAL",
  GOOGLE = "GOOGLE",
}

export enum Plan {
  FREE = "FREE",
  PREMIUM_DE = "PREMIUM_DE",
  PREMIUM_EU = "PREMIUM_EU",
  LAUNCH_PREMIUM = "LAUNCH_PREMIUM",
  BASIC = "BASIC",
  PREMIUM = "PREMIUM",
}

export enum DevicePlatform {
  IOS = "ios",
  ANDROID = "android",
  WEB = "web",
}

export interface IFcmTokenEntry {
  deviceId: string;
  token: string;
  platform: DevicePlatform;
  deviceName?: string;
  lastActiveAt: Date;
  createdAt: Date;
}

export const FCM_TOKEN_CONFIG = {
  MAX_DEVICES_PER_USER: 10,
  STALE_TOKEN_DAYS: 30,
};

export interface IUser extends Document {
  _id: string;
  fullName: string;
  userName?: string;
  email: string;
  mobileNumber: string;
  password: string;
  profilePicture?: string;
  profilePicturePublicId?: string;
  role: UserRole;
  companyName?: string;
  businessEmail?: string;
  contactPersonName?: string;
  businessRegDocument?: string;
  taxIdDocument?: string;
  hasVerificationBadge?: boolean;
  status: UserStatus;
  isVerified: boolean;
  verificationOtp?: string;
  verificationOtpExpiry?: Date;
  resetPasswordOtp?: string;
  resetPasswordOtpExpiry?: Date;
  googleId?: string;
  authProvider?: AuthProvider;
  premiumPlanExpiry?: Date;
  country?: string;
  language?: string;
  timezone?: string;
  postalCode?: string;
  workLocations?: string[];
  skills?: string[];
  spokenLanguages?: string[];
  driversLicense?: string;
  hourlyRate?: number;
  dailyRate?: number;
  experienceYears?: number;
  bio?: string;
  rating?: number;
  jobCompleted?: number;
  plan?: Plan;
  swipeCount?: number;
  swipeCountResetAt?: Date;
  lattitude?: number;
  longitude?: number;
  fcmTokens: IFcmTokenEntry[];
  isOnline: boolean;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    profilePicture: {
      type: String,
    },
    profilePicturePublicId: {
      type: String,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
    },
    companyName: {
      type: String,
      trim: true,
    },
    businessEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    contactPersonName: {
      type: String,
      trim: true,
    },
    businessRegDocument: {
      type: String,
    },
    taxIdDocument: {
      type: String,
    },
    hasVerificationBadge: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOtp: {
      type: String,
      select: false,
    },
    verificationOtpExpiry: {
      type: Date,
      select: false,
    },
    resetPasswordOtp: {
      type: String,
      select: false,
    },
    resetPasswordOtpExpiry: {
      type: Date,
      select: false,
    },
    googleId: {
      type: String,
    },
    authProvider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL,
    },
    premiumPlanExpiry: {
      type: Date,
    },
    country: {
      type: String,
    },
    language: {
      type: String,
    },
    timezone: {
      type: String,
    },
    postalCode: {
      type: String,
    },
    workLocations: [
      {
        type: String,
      },
    ],
    skills: [
      {
        type: String,
      },
    ],
    spokenLanguages: [
      {
        type: String,
      },
    ],
    driversLicense: {
      type: String,
    },
    hourlyRate: {
      type: Number,
    },
    dailyRate: {
      type: Number,
    },
    experienceYears: {
      type: Number,
    },
    bio: {
      type: String,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    jobCompleted: {
      type: Number,
      default: 0,
    },
    plan: {
      type: String,
      enum: Object.values(Plan),
      default: Plan.FREE,
    },
    swipeCount: {
      type: Number,
      default: 0,
    },
    swipeCountResetAt: {
      type: Date,
      default: () => new Date(),
    },
    lattitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    fcmTokens: [
      {
        deviceId: { type: String, required: true },
        token: { type: String, required: true },
        platform: {
          type: String,
          enum: Object.values(DevicePlatform),
          required: true,
        },
        deviceName: { type: String },
        lastActiveAt: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for better query performance (email index created by unique: true)
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ mobileNumber: 1 });
UserSchema.index({ googleId: 1 });
UserSchema.index({ "fcmTokens.deviceId": 1 });
UserSchema.index({ "fcmTokens.token": 1 });
UserSchema.index({ country: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
