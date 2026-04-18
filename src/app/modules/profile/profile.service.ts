import * as bcrypt from "bcrypt";
import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { User, UserRole } from "../../models";
import { fileUploader } from "../../../helpars/fileUploader";
import e from "express";
import { pl } from "zod/v4/locales";

const getCompanyProfile = async (companyId: string) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const company = await User.findById(companyId).select(
    "fullName mobileNumber profilePicture",
  );

  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Company not found");
  }

  return company;
};

const updateCompanyProfile = async (
  companyId: string,
  payload: {
    fullName?: string;
    mobileNumber?: string;
  },
  profilePictureFile?: Express.Multer.File,
): Promise<{
  fullName?: string;
  mobileNumber?: string;
  profilePicture?: string;
  updatedAt: Date;
}> => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const company = await User.findById(companyId);
  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Company not found");
  }

  if (company.role !== UserRole.COMPANY) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only companies can update this profile",
    );
  }

  const updateData: Record<string, unknown> = {};

  if (payload.fullName) {
    updateData.fullName = payload.fullName;
  }
  if (payload.mobileNumber) {
    updateData.mobileNumber = payload.mobileNumber;
  }

  if (profilePictureFile) {
    const uploaded = await fileUploader.uploadToCloudinary(
      profilePictureFile,
      "messematch/profiles",
    );
    updateData.profilePicture = uploaded.Location;
    updateData.profilePicturePublicId = uploaded.public_id;

    if (company.profilePicturePublicId) {
      fileUploader
        .deleteFromCloudinary(company.profilePicturePublicId)
        .catch((err) => {
          console.error("Failed to delete old profile picture:", err);
        });
    }
  }

  const updatedCompany = await User.findByIdAndUpdate(companyId, updateData, {
    new: true,
    runValidators: true,
  }).select("fullName mobileNumber profilePicture updatedAt");

  if (!updatedCompany) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update profile",
    );
  }

  return {
    fullName: updatedCompany.fullName,
    mobileNumber: updatedCompany.mobileNumber,
    profilePicture: updatedCompany.profilePicture,
    updatedAt: updatedCompany.updatedAt,
  };
};

const getCompanyInfo = async (companyId: string) => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const company = await User.findById(companyId).select(
    "companyName businessEmail contactPersonName",
  );

  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Company not found");
  }

  return company;
};

const updateCompanyInfo = async (
  companyId: string,
  payload: {
    companyName?: string;
    businessEmail?: string;
    contactPersonName?: string;
  },
): Promise<{
  companyName?: string;
  businessEmail?: string;
  contactPersonName?: string;
  updatedAt: Date;
}> => {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid company ID");
  }

  const company = await User.findById(companyId);
  if (!company) {
    throw new ApiError(httpStatus.NOT_FOUND, "Company not found");
  }

  if (company.role !== UserRole.COMPANY) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only companies can update this profile",
    );
  }

  const updateData: Record<string, unknown> = {};

  if (payload.companyName) {
    updateData.companyName = payload.companyName;
  }
  if (payload.businessEmail) {
    updateData.businessEmail = payload.businessEmail;
  }
  if (payload.contactPersonName) {
    updateData.contactPersonName = payload.contactPersonName;
  }

  const updatedCompany = await User.findByIdAndUpdate(companyId, updateData, {
    new: true,
    runValidators: true,
  }).select("companyName businessEmail contactPersonName updatedAt");

  if (!updatedCompany) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update profile",
    );
  }

  return {
    companyName: updatedCompany.companyName,
    businessEmail: updatedCompany.businessEmail,
    contactPersonName: updatedCompany.contactPersonName,
    updatedAt: updatedCompany.updatedAt,
  };
};

const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => {
  const user = await User.findById(userId).select("+password").lean();

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.password) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Cannot change password for Google sign-in accounts",
    );
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.findByIdAndUpdate(userId, { password: hashedPassword });

  return { message: "Password changed successfully" };
};

const getFitterProfile = async (fitterId: string) => {
  if (!mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  const fitter = await User.findById(fitterId)
    .select(
      "role fullName profilePicture workLocations skills spokenLanguages hourlyRate dailyRate experienceYears bio rating jobCompleted plan",
    )
    .lean();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  if (fitter.role !== UserRole.FITTER) {
    throw new ApiError(httpStatus.FORBIDDEN, "User is not a fitter");
  }

  return {
    fullName: fitter.fullName,
    profilePicture: fitter.profilePicture,
    rating: fitter.rating,
    jobCompleted: fitter.jobCompleted,
    workLocations: fitter.workLocations,
    hourlyRate: fitter.hourlyRate,
    dailyRate: fitter.dailyRate,
    experienceYears: fitter.experienceYears,
    plan: fitter.plan,
    bio: fitter.bio,
    skills: fitter.skills,
    spokenLanguages: fitter.spokenLanguages,
  };
};

const getFitterProfileForUpdate = async (fitterId: string) => {
  if (!mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  const fitter = await User.findById(fitterId)
    .select(
      "role profilePicture fullName userName mobileNumber postalCode workLocations hourlyRate dailyRate experienceYears bio",
    )
    .lean();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  if (fitter.role !== UserRole.FITTER) {
    throw new ApiError(httpStatus.FORBIDDEN, "User is not a fitter");
  }

  return {
    profilePicture: fitter.profilePicture,
    fullName: fitter.fullName,
    username: fitter.userName,
    mobileNumber: fitter.mobileNumber,
    postalCode: fitter.postalCode,
    workLocations: fitter.workLocations,
    hourlyRate: fitter.hourlyRate,
    dailyRate: fitter.dailyRate,
    experienceYears: fitter.experienceYears,
    bio: fitter.bio,
  };
};

const updateFitterProfile = async (
  fitterId: string,
  payload: {
    profilePictureFile?: Express.Multer.File;
    fullName?: string;
    userName?: string;
    mobileNumber?: string;
    postalCode?: string;
    workLocations?: string[];
    hourlyRate?: number;
    dailyRate?: number;
    experienceYears?: number;
    bio?: string;
  },
) => {
  if (!mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  const fitter = await User.findById(fitterId);
  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  if (fitter.role !== UserRole.FITTER) {
    throw new ApiError(httpStatus.FORBIDDEN, "User is not a fitter");
  }

  const updateData: Record<string, unknown> = {};

  if (payload.fullName !== undefined) {
    updateData.fullName = payload.fullName;
  }
  if (payload.userName !== undefined) {
    updateData.userName = payload.userName;
  }
  if (payload.mobileNumber !== undefined) {
    updateData.mobileNumber = payload.mobileNumber;
  }
  if (payload.postalCode !== undefined) {
    updateData.postalCode = payload.postalCode;
  }
  if (payload.workLocations !== undefined) {
    updateData.workLocations = payload.workLocations;
  }
  if (payload.hourlyRate !== undefined) {
    updateData.hourlyRate = payload.hourlyRate;
  }
  if (payload.dailyRate !== undefined) {
    updateData.dailyRate = payload.dailyRate;
  }
  if (payload.experienceYears !== undefined) {
    updateData.experienceYears = payload.experienceYears;
  }
  if (payload.bio !== undefined) {
    updateData.bio = payload.bio;
  }

  if (payload.profilePictureFile) {
    const uploaded = await fileUploader.uploadToCloudinary(
      payload.profilePictureFile,
      "messematch/profiles",
    );
    updateData.profilePicture = uploaded.Location;
    updateData.profilePicturePublicId = uploaded.public_id;

    if (fitter.profilePicturePublicId) {
      fileUploader
        .deleteFromCloudinary(fitter.profilePicturePublicId)
        .catch((err) => {
          console.error("Failed to delete old profile picture:", err);
        });
    }
  }

  const updatedFitter = await User.findByIdAndUpdate(fitterId, updateData, {
    new: true,
    runValidators: true,
  }).select(
    "role profilePicture fullName userName mobileNumber postalCode workLocations hourlyRate dailyRate experienceYears bio updatedAt",
  );

  if (!updatedFitter) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update profile",
    );
  }

  return {
    profilePicture: updatedFitter.profilePicture,
    fullName: updatedFitter.fullName,
    username: updatedFitter.userName,
    mobileNumber: updatedFitter.mobileNumber,
    postalCode: updatedFitter.postalCode,
    workLocations: updatedFitter.workLocations,
    hourlyRate: updatedFitter.hourlyRate,
    dailyRate: updatedFitter.dailyRate,
    experienceYears: updatedFitter.experienceYears,
    bio: updatedFitter.bio,
    updatedAt: updatedFitter.updatedAt,
  };
};

const getSkillsLanguagesAndLicensesForUpdate = async (fitterId: string) => {
  if (!mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }
  const fitter = await User.findById(fitterId)
    .select("role skills spokenLanguages driversLicense")
    .lean();

  if (!fitter) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  return {
    skills: fitter.skills,
    spokenLanguages: fitter.spokenLanguages,
    driversLicense: fitter.driversLicense,
  };
};

export const profileService = {
  getCompanyProfile,
  updateCompanyProfile,
  getCompanyInfo,
  updateCompanyInfo,
  changePassword,
  getFitterProfile,
  getFitterProfileForUpdate,
  updateFitterProfile,
  getSkillsLanguagesAndLicensesForUpdate,
};
