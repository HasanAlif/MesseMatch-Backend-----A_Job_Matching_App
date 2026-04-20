import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { AppContent, ContentType } from "./appContent.model";
import { User, UserRole } from "../../models";
import { paginationHelper } from "../../../helpars/paginationHelper";
import { fileUploader } from "../../../helpars/fileUploader";

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

const getAllUsers = async (status?: string, page?: number, limit?: number) => {
  const query: Record<string, unknown> = {};

  if (status) {
    query.status = status;
  }

  const total = await User.countDocuments(query);

  const hasPagination = page !== undefined || limit !== undefined;

  let users;
  if (hasPagination) {
    const paginationData = paginationHelper.calculatePagination({
      page,
      limit,
    });

    users = await User.find(query, {
      fullName: 1,
      email: 1,
      profilePicture: 1,
      mobileNumber: 1,
      createdAt: 1,
      role: 1,
      status: 1,
    })
      .sort({ createdAt: -1 })
      .skip(paginationData.skip)
      .limit(paginationData.limit)
      .lean();

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    const formattedUsers = users.map((user) => ({
      profilePicture: user.profilePicture || null,
      name: user.fullName || null,
      email: user.email || null,
      phoneNumber: user.mobileNumber || null,
      joinedDate: user.createdAt ? formatDate(user.createdAt) : null,
      role: user.role || null,
      status: user.status || null,
    }));

    return {
      meta: {
        page: paginationData.page,
        limit: paginationData.limit,
        total,
        totalPages: Math.ceil(total / paginationData.limit),
      },
      data: formattedUsers,
    };
  }

  users = await User.find(query, {
    fullName: 1,
    email: 1,
    profilePicture: 1,
    mobileNumber: 1,
    country: 1,
    role: 1,
    status: 1,
  })
    .sort({ createdAt: -1 })
    .lean();

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formattedUsers = users.map((user) => ({
    profilePicture: user.profilePicture || null,
    name: user.fullName || null,
    email: user.email || null,
    phoneNumber: user.mobileNumber || null,
    joinedDate: user.createdAt ? formatDate(user.createdAt) : null,
    role: user.role || null,
    status: user.status || null,
  }));

  return {
    meta: {
      page: 1,
      limit: total,
      total,
      totalPages: 1,
    },
    data: formattedUsers,
  };
};

const searchUsers = async (
  searchQuery: string,
  page?: number,
  limit?: number,
) => {
  const paginationData = paginationHelper.calculatePagination({ page, limit });

  const query = searchQuery?.trim() || "";

  if (!query) {
    return {
      meta: {
        page: paginationData.page,
        limit: paginationData.limit,
        total: 0,
        totalPages: 0,
      },
      data: [],
    };
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const queryLower = query.toLowerCase();

  const pipeline = [
    {
      $match: {
        role: UserRole.FITTER,
        $or: [
          { fullName: { $regex: escapedQuery, $options: "i" } },
          { email: { $regex: escapedQuery, $options: "i" } },
          { mobileNumber: { $regex: escapedQuery, $options: "i" } },
        ],
      },
    },
    {
      $addFields: {
        relevanceScore: {
          $add: [
            {
              $cond: [
                {
                  $eq: [
                    { $toLower: { $ifNull: ["$fullName", ""] } },
                    queryLower,
                  ],
                },
                100,
                0,
              ],
            },
            {
              $cond: [
                {
                  $eq: [{ $toLower: { $ifNull: ["$email", ""] } }, queryLower],
                },
                100,
                0,
              ],
            },
            {
              $cond: [
                { $eq: [{ $ifNull: ["$mobileNumber", ""] }, query] },
                100,
                0,
              ],
            },

            {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$fullName", ""] },
                    regex: `^${escapedQuery}`,
                    options: "i",
                  },
                },
                50,
                0,
              ],
            },
            {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$email", ""] },
                    regex: `^${escapedQuery}`,
                    options: "i",
                  },
                },
                50,
                0,
              ],
            },
            {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$mobileNumber", ""] },
                    regex: `^${escapedQuery}`,
                    options: "i",
                  },
                },
                50,
                0,
              ],
            },

            {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$fullName", ""] },
                    regex: escapedQuery,
                    options: "i",
                  },
                },
                10,
                0,
              ],
            },
            {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$email", ""] },
                    regex: escapedQuery,
                    options: "i",
                  },
                },
                10,
                0,
              ],
            },
            {
              $cond: [
                {
                  $regexMatch: {
                    input: { $ifNull: ["$mobileNumber", ""] },
                    regex: escapedQuery,
                    options: "i",
                  },
                },
                10,
                0,
              ],
            },
          ],
        },
      },
    },
    { $sort: { relevanceScore: -1 as const, createdAt: -1 as const } },
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: paginationData.skip },
          { $limit: paginationData.limit },
          {
            $project: {
              fullName: 1,
              email: 1,
              profilePicture: 1,
              mobileNumber: 1,
              createdAt: 1,
              role: 1,
              status: 1,
            },
          },
        ],
      },
    },
  ];

  const [result] = await User.aggregate(pipeline);
  const total = result?.metadata[0]?.total || 0;
  const users = result?.data || [];

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formattedUsers = users.map(
    (user: {
      _id: string;
      fullName?: string;
      email?: string;
      profilePicture?: string;
      mobileNumber?: string;
      role?: string;
      status?: string;
      createdAt?: Date;
    }) => ({
      id: user._id,
      profilePicture: user.profilePicture || null,
      name: user.fullName || null,
      email: user.email || null,
      phoneNumber: user.mobileNumber || null,
      role: user.role || null,
      joinedDate: user.createdAt ? formatDate(user.createdAt) : null,
      status: user.status || null,
    }),
  );

  return {
    meta: {
      page: paginationData.page,
      limit: paginationData.limit,
      total,
      totalPages: Math.ceil(total / paginationData.limit) || 0,
    },
    data: formattedUsers,
  };
};

const getAdminProfile = async (adminId: string) => {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid admin ID");
  }

  const admin = await User.findById(adminId, {
    profilePicture: 1,
    fullName: 1,
    role: 1,
  }).lean();

  if (!admin) {
    throw new ApiError(httpStatus.NOT_FOUND, "Admin not found");
  }

  return {
    profilePicture: admin.profilePicture || null,
    name: admin.fullName || null,
    role: admin.role || null,
  };
};

const updateAdminProfile = async (
  adminId: string,
  fullName: string | undefined,
  profilePictureFile?: Express.Multer.File,
) => {
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid admin ID");
  }

  const admin = await User.findById(adminId);

  if (!admin) {
    throw new ApiError(httpStatus.NOT_FOUND, "Admin not found");
  }

  const updateData: Record<string, unknown> = {};

  if (fullName && fullName.trim()) {
    updateData.fullName = fullName.trim();
  }

  if (profilePictureFile) {
    // Upload new profile picture to Cloudinary
    const uploadedFile =
      await fileUploader.uploadProfileImage(profilePictureFile);
    updateData.profilePicture = uploadedFile.Location;
    updateData.profilePicturePublicId = uploadedFile.public_id;

    // Delete old profile picture from Cloudinary if it exists
    if (admin.profilePicturePublicId) {
      await fileUploader.deleteFromCloudinary(admin.profilePicturePublicId);
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No data provided for update");
  }

  const updatedAdmin = await User.findByIdAndUpdate(
    adminId,
    { $set: updateData },
    {
      new: true,
      runValidators: true,
      select: "profilePicture fullName role profilePicturePublicId",
    },
  ).lean();

  return {
    profilePicture: updatedAdmin?.profilePicture || null,
    name: updatedAdmin?.fullName || null,
    role: updatedAdmin?.role || null,
  };
};

export const adminService = {
  getContentTypeName,
  createOrUpdateContent,
  getContentByType,
  getMonthlyUserGrowth,
  getRecentUsers,
  getAllUsers,
  searchUsers,
  getAdminProfile,
  updateAdminProfile,
};
