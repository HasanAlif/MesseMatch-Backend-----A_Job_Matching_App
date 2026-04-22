import mongoose from "mongoose";
import ApiError from "../../../errors/ApiErrors";
import httpStatus from "http-status";
import { User, UserRole, Plan } from "../../models";

interface SwipeCountResponse {
  swipeCount: number;
  updatedAt: Date;
}

interface UpdatePlanResponse {
  plan: Plan;
  updatedAt: Date;
}

// Allowed plans per role
const FITTER_PLANS = [Plan.FREE, Plan.PREMIUM_DE, Plan.PREMIUM_EU];
const COMPANY_PLANS = [
  Plan.FREE,
  Plan.LAUNCH_PREMIUM,
  Plan.BASIC,
  Plan.PREMIUM,
];

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

const updatePlanStatus = async (
  userId: string,
  newPlan: Plan,
): Promise<UpdatePlanResponse> => {
  // Validate userId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID");
  }

  // Fetch user to get role and validate existence
  const user = await User.findById(userId).select("role plan");
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // Validate plan is allowed for user's role
  const allowedPlans =
    user.role === UserRole.FITTER ? FITTER_PLANS : COMPANY_PLANS;
  if (!allowedPlans.includes(newPlan)) {
    const roleDisplay = user.role === UserRole.FITTER ? "fitter" : "company";
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Plan "${newPlan}" is not available for ${roleDisplay} role. Available plans: ${allowedPlans.join(", ")}`,
    );
  }

  // Update user plan
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { plan: newPlan },
    { new: true, runValidators: false },
  ).select("plan updatedAt");

  if (!updatedUser) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to update plan",
    );
  }

  return {
    plan: updatedUser.plan || Plan.FREE,
    updatedAt: updatedUser.updatedAt,
  };
};

export const subscriptionService = {
  swipeCountForFitter,
  updatePlanStatus,
};
