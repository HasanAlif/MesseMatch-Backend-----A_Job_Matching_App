import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { User } from "../../models";

interface SwipeCountResponse {
  swipeCount: number;
  updatedAt: Date;
}

const swipeCountForFitter = async (
  fitterId: string,
): Promise<SwipeCountResponse> => {
  if (!fitterId || !mongoose.Types.ObjectId.isValid(fitterId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid fitter ID");
  }

  const updatedUser = await User.findByIdAndUpdate(
    fitterId,
    { $inc: { swipeCount: 1 } },
    { new: true, runValidators: false },
  );

  if (!updatedUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "Fitter not found");
  }

  return {
    swipeCount: updatedUser.swipeCount || 0,
    updatedAt: updatedUser.updatedAt,
  };
};

export const subscriptionService = {
  swipeCountForFitter,
};
