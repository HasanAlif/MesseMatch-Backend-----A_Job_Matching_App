import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { User, UserRole } from "../../models";
import { fileUploader } from "../../../helpars/fileUploader";

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

export const profileService = {
  updateCompanyProfile,
  getCompanyProfile,
};
