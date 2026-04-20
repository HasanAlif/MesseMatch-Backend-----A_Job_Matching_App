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

const getRecentUsers = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const users = await User.find(
    {
      createdAt: { $gte: sevenDaysAgo },
    },
    {
      fullName: 1,
      email: 1,
      profilePicture: 1,
      mobileNumber: 1,
      role: 1,
      createdAt: 1,
      status: 1,
    },
  )
    .sort({ createdAt: -1 })
    .lean();

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return users.map((user) => ({
    profilePicture: user.profilePicture || null,
    name: user.fullName || null,
    email: user.email || null,
    phoneNumber: user.mobileNumber || null,
    role: user.role || null,
    joinedDate: user.createdAt ? formatDate(user.createdAt) : null,
    status: user.status || null,
  }));
};

export const adminService = {
  getContentTypeName,
  createOrUpdateContent,
  getContentByType,
  getMonthlyUserGrowth,
  getRecentUsers,
};
