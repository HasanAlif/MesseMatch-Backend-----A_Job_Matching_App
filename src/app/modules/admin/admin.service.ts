import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { AppContent, ContentType } from "./appContent.model";

const getContentTypeName = (type: ContentType): string => {
  const typeNames: Record<ContentType, string> = {
    [ContentType.ABOUT_US]: "About Us",
    [ContentType.PRIVACY_POLICY]: "Privacy Policy",
    [ContentType.TERMS_AND_CONDITIONS]: "Terms and Conditions",
  };
  return typeNames[type] || type;
};

const createOrUpdateContent = async (type: ContentType, content: string) => {
  const result = await AppContent.findOneAndUpdate(
    { type },
    { content },
    { new: true, upsert: true, runValidators: true },
  );
  return result;
};

const getContentByType = async (type: ContentType) => {
  const result = await AppContent.findOne({ type });
  if (!result) {
    return {
      _id: null,
      type,
      content: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return result;
};

export const adminService = {
  getContentTypeName,
  createOrUpdateContent,
  getContentByType,
};
