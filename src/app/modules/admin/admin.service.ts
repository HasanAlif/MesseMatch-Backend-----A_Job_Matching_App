import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { AppContent, ContentType } from "./appContent.model";
import { User } from "../../models";

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

const getMonthlyUserGrowth = async (year: number) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const result = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        newUsers: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  const monthlyDataMap = new Map(
    result.map((item) => [item._id, item.newUsers]),
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    newUsers: monthlyDataMap.get(i + 1) || 0,
  }));

  return { year, months };
};

export const adminService = {
  getContentTypeName,
  createOrUpdateContent,
  getContentByType,
  getMonthlyUserGrowth,
};
